// Ashen Oath launcher for Windows: serves the game folder on a fixed local port inside this process and
// shows it in the game's own window (WebView2, the web engine built into Windows 10 and 11), so it runs
// like a regular app: own window and icon, full screen by default (Menu > Display or F11 to change), saves kept in %LOCALAPPDATA%\AshenOath.
// Without WebView2 the default browser is used and a small dialog keeps the game running until dismissed.
package main

import (
	"fmt"
	"mime"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"unsafe"

	webview2 "github.com/jchv/go-webview2"
)

var ports = []int{47653, 47654, 47655, 47656, 47657}

var (
	user32          = syscall.NewLazyDLL("user32.dll")
	pMessageBox     = user32.NewProc("MessageBoxW")
	pLoadImage      = user32.NewProc("LoadImageW")
	pSendMessage    = user32.NewProc("SendMessageW")
	pShowWindow     = user32.NewProc("ShowWindow")
	pGetWindowLong  = user32.NewProc("GetWindowLongPtrW")
	pSetWindowLong  = user32.NewProc("SetWindowLongPtrW")
	pSetWindowPos   = user32.NewProc("SetWindowPos")
	pMonitorFromWin = user32.NewProc("MonitorFromWindow")
	pGetMonitorInfo = user32.NewProc("GetMonitorInfoW")
	pGetWindowRect  = user32.NewProc("GetWindowRect")
)

func messageBox(title, text string, flags uintptr) {
	t, _ := syscall.UTF16PtrFromString(title)
	m, _ := syscall.UTF16PtrFromString(text)
	pMessageBox.Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), flags)
}

func ours(port int) bool {
	r, err := http.Get(fmt.Sprintf("http://127.0.0.1:%d/ashen-oath.txt", port))
	if err != nil {
		return false
	}
	defer r.Body.Close()
	return r.StatusCode == 200
}

// ---- borderless full screen on F11 ----
type rect struct{ L, T, R, B int32 }
type monitorInfo struct {
	Size          uint32
	Monitor, Work rect
	Flags         uint32
}

const gwlStyle = ^uintptr(15) // GWL_STYLE = -16
const wsOverlappedWindow = 0x00CF0000

// Display modes: "fullscreen" (borderless, covers the monitor), "maximized" (normal window with borders, maximized)
// and "windowed" (a 1600x900 window, centred). The choice is kept in %LOCALAPPDATA%\AshenOath\display.txt.
var mode = "fullscreen"
var savedStyle uintptr
var styleSaved bool

func settingsPath() string {
	return filepath.Join(os.Getenv("LOCALAPPDATA"), "AshenOath", "display.txt")
}

func loadMode() {
	if b, err := os.ReadFile(settingsPath()); err == nil {
		switch m := string(b); m {
		case "fullscreen", "maximized", "windowed":
			mode = m
		}
	}
}

func setMode(hwnd uintptr, m string) {
	if !styleSaved {
		savedStyle, _, _ = pGetWindowLong.Call(hwnd, gwlStyle)
		savedStyle |= wsOverlappedWindow
		styleSaved = true
	}
	mon, _, _ := pMonitorFromWin.Call(hwnd, 2)
	mi := monitorInfo{Size: uint32(unsafe.Sizeof(monitorInfo{}))}
	pGetMonitorInfo.Call(mon, uintptr(unsafe.Pointer(&mi)))
	switch m {
	case "fullscreen":
		pShowWindow.Call(hwnd, 9) // SW_RESTORE
		pSetWindowLong.Call(hwnd, gwlStyle, savedStyle&^wsOverlappedWindow)
		pSetWindowPos.Call(hwnd, 0, uintptr(mi.Monitor.L), uintptr(mi.Monitor.T),
			uintptr(mi.Monitor.R-mi.Monitor.L), uintptr(mi.Monitor.B-mi.Monitor.T), 0x0020|0x0040) // FRAMECHANGED|SHOWWINDOW
	case "maximized":
		pSetWindowLong.Call(hwnd, gwlStyle, savedStyle)
		pSetWindowPos.Call(hwnd, 0, 0, 0, 0, 0, 0x0020|0x0040|0x0001|0x0002) // keep size and position, redraw the frame
		pShowWindow.Call(hwnd, 3)                                            // SW_MAXIMIZE
	default: // windowed
		pShowWindow.Call(hwnd, 9)
		pSetWindowLong.Call(hwnd, gwlStyle, savedStyle)
		w, h := int32(1600), int32(900)
		if ww := mi.Work.R - mi.Work.L; w > ww-40 {
			w = ww - 40
			h = w * 9 / 16
		}
		x := mi.Work.L + (mi.Work.R-mi.Work.L-w)/2
		y := mi.Work.T + (mi.Work.B-mi.Work.T-h)/2
		pSetWindowPos.Call(hwnd, 0, uintptr(x), uintptr(y), uintptr(w), uintptr(h), 0x0020|0x0040)
		m = "windowed"
	}
	mode = m
	os.MkdirAll(filepath.Dir(settingsPath()), 0o755)
	os.WriteFile(settingsPath(), []byte(m), 0o644)
}

func main() {
	exe, _ := os.Executable()
	dir := filepath.Dir(exe)
	root := filepath.Join(dir, "game")
	if _, err := os.Stat(filepath.Join(root, "index.html")); err != nil {
		messageBox("Ashen Oath", "The game files are missing. Please reinstall Ashen Oath.", 0x10)
		return
	}
	// Windows maps some extensions to wrong types in the registry; ES modules need text/javascript
	for ext, typ := range map[string]string{".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
		".webp": "image/webp", ".png": "image/png", ".mp4": "video/mp4", ".css": "text/css", ".woff2": "font/woff2", ".html": "text/html; charset=utf-8"} {
		mime.AddExtensionType(ext, typ)
	}
	var ln net.Listener
	port := 0
	for _, p := range ports {
		l, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", p))
		if err == nil {
			ln, port = l, p
			break
		}
		if ours(p) { // the game is already open: show it again in a new window
			port = p
			break
		}
	}
	if port == 0 {
		messageBox("Ashen Oath", "Could not start: the local ports 47653-47657 are all in use.", 0x10)
		return
	}
	if ln != nil {
		fs := http.FileServer(http.Dir(root))
		go http.Serve(ln, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-cache")
			fs.ServeHTTP(w, r)
		}))
	}
	url := fmt.Sprintf("http://127.0.0.1:%d/", port)

	data := filepath.Join(os.Getenv("LOCALAPPDATA"), "AshenOath", "webview")
	os.MkdirAll(data, 0o755)
	w := webview2.NewWithOptions(webview2.WebViewOptions{
		DataPath:      data,
		AutoFocus:     true,
		WindowOptions: webview2.WindowOptions{Title: "Ashen Oath", Width: 1600, Height: 900, Center: true},
	})
	if w == nil { // no WebView2 runtime: fall back to the default browser
		exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
		if ln != nil {
			messageBox("Ashen Oath", "Ashen Oath is running in your web browser.\n\nKeep this message open while you play; press OK to close the game.", 0x40)
		}
		return
	}
	defer w.Destroy()
	hwnd := uintptr(w.Window())
	if ico, err := syscall.UTF16PtrFromString(filepath.Join(dir, "ashen.ico")); err == nil {
		big, _, _ := pLoadImage.Call(0, uintptr(unsafe.Pointer(ico)), 1, 256, 256, 0x10) // IMAGE_ICON, LR_LOADFROMFILE
		small, _, _ := pLoadImage.Call(0, uintptr(unsafe.Pointer(ico)), 1, 32, 32, 0x10)
		if big != 0 {
			pSendMessage.Call(hwnd, 0x0080, 1, big) // WM_SETICON, ICON_BIG
		}
		if small != 0 {
			pSendMessage.Call(hwnd, 0x0080, 0, small)
		}
	}
	loadMode()
	setMode(hwnd, mode) // fullscreen unless the player chose otherwise last time
	// F11 switches between fullscreen and a window with borders; the in-game Menu > Display picks any of the three
	w.Bind("ashenFullscreen", func() {
		w.Dispatch(func() {
			if mode == "fullscreen" {
				setMode(hwnd, "maximized")
			} else {
				setMode(hwnd, "fullscreen")
			}
		})
	})
	w.Bind("ashenDisplay", func(m string) { w.Dispatch(func() { setMode(hwnd, m) }) })
	w.Bind("ashenDisplayMode", func() string { return mode })
	w.Bind("ashenQuit", func() { w.Dispatch(func() { w.Terminate() }) })
	// F11 toggles full screen; the game's Quit (window.close) closes the app
	w.Init(`window.addEventListener('keydown', e => { if (e.key === 'F11') { e.preventDefault(); window.ashenFullscreen && window.ashenFullscreen(); } }, true);
window.close = () => { window.ashenQuit && window.ashenQuit(); };`)
	w.Navigate(url)
	w.Run()
}
