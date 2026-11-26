"""Intro trailer: joins assets/source/intro/scene1.mp4, scene2.mp4 ... in order with crossfades
(picture and sound), fades in from black and out to black, and writes assets/intro/intro.mp4
(H.264 + AAC, web-ready). Add scene4.mp4, scene5.mp4 and run again."""
import glob, os, re, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source', 'intro'); OUT = os.path.join(ROOT, 'assets', 'intro', 'intro.mp4')
XF = 0.8   # crossfade length in seconds
scenes = sorted(glob.glob(os.path.join(SRC, 'scene*.mp4')), key=lambda p: int(re.findall(r'\d+', os.path.basename(p))[0]))
dur = [float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p])) for p in scenes]
inp = sum((['-i', p] for p in scenes), [])
fv, fa = [], []
for i in range(len(scenes)):
    fv.append(f'[{i}:v]scale=1280:720,fps=24,format=yuv420p,setpts=PTS-STARTPTS[v{i}]')
    fa.append(f'[{i}:a]aformat=sample_rates=44100:channel_layouts=stereo,asetpts=PTS-STARTPTS[a{i}]')
vlast, alast, t = 'v0', 'a0', dur[0]
for i in range(1, len(scenes)):
    off = t - XF
    fv.append(f'[{vlast}][v{i}]xfade=transition=fade:duration={XF}:offset={off:.3f}[vx{i}]')
    fa.append(f'[{alast}][a{i}]acrossfade=d={XF}[ax{i}]')
    vlast, alast, t = f'vx{i}', f'ax{i}', off + dur[i]
fv.append(f'[{vlast}]fade=t=in:st=0:d=0.6,fade=t=out:st={t - 1.0:.3f}:d=1.0[vout]')
fa.append(f'[{alast}]afade=t=in:st=0:d=0.6,afade=t=out:st={t - 1.2:.3f}:d=1.2[aout]')
subprocess.run(['ffmpeg', '-v', 'error', '-y', *inp, '-filter_complex', ';'.join(fv + fa), '-map', '[vout]', '-map', '[aout]',
                '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                '-c:a', 'aac', '-b:a', '128k', OUT], check=True)
print(len(scenes), 'scenes,', round(t, 2), 's,', os.path.getsize(OUT) // 1024, 'KB')
