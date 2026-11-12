import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Aperture, AudioLines, Captions, Check, ChevronDown, Clapperboard, Download,
  Film, FolderOpen, Gauge, ImagePlus, Layers, Moon, Music2, Play, Plus,
  Scissors, Settings2, Sun, Type, Upload, WandSparkles, Volume2, X
} from 'lucide-react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

type Clip = { id: string; name: string; url: string; file: File; duration: number; kind: 'video'|'audio'|'image' }
const fmt = (n: number) => `${Math.floor(n/60).toString().padStart(2,'0')}:${Math.floor(n%60).toString().padStart(2,'0')}`
const uid = () => Math.random().toString(36).slice(2, 10)

export default function App() {
  const [theme, setTheme] = useState<'dark'|'light'>(() => (localStorage.getItem('pk-theme') as 'dark'|'light') || 'dark')
  const [clips, setClips] = useState<Clip[]>([])
  const [selected, setSelected] = useState<string>('')
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [volume, setVolume] = useState(100)
  const [speed, setSpeed] = useState(1)
  const [titleText, setTitleText] = useState('')
  const [showTitle, setShowTitle] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState('')
  const [ffmpegReady, setFfmpegReady] = useState(false)
  const [aiText, setAiText] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [captionText, setCaptionText] = useState('')
  const [projectName, setProjectName] = useState('Untitled project')
  const videoRef = useRef<HTMLVideoElement>(null)
  const ffmpegRef = useRef<FFmpeg | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const audioInput = useRef<HTMLInputElement>(null)
  const active = clips.find(c => c.id === selected) || clips.find(c => c.kind === 'video')
  const videoClips = clips.filter(c => c.kind === 'video' || c.kind === 'image')
  const totalDuration = useMemo(() => videoClips.reduce((a,c)=>a+c.duration,0), [videoClips])

  useEffect(() => { localStorage.setItem('pk-theme', theme) }, [theme])
  useEffect(() => {
    if (active) {
      setTrimStart(0); setTrimEnd(active.duration || 0); setCurrent(0)
      if (videoRef.current && active.kind === 'video') {
        videoRef.current.src = active.url
        videoRef.current.load()
      }
    }
  }, [selected, clips.length])
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const tick = () => setCurrent(v.currentTime)
    const ended = () => setPlaying(false)
    v.addEventListener('timeupdate', tick); v.addEventListener('ended', ended)
    return () => { v.removeEventListener('timeupdate', tick); v.removeEventListener('ended', ended) }
  }, [active?.id])
  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume / 100
  }, [volume])

  const addFiles = (list: FileList | null, kindHint?: 'audio') => {
    if (!list) return
    const next: Clip[] = Array.from(list).map(file => {
      const kind = kindHint || (file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('image/') ? 'image' : 'video')
      return { id: uid(), name: file.name, url: URL.createObjectURL(file), file, duration: kind === 'image' ? 5 : 0, kind }
    })
    next.forEach(c => {
      if (c.kind !== 'image' && c.kind !== 'audio') {
        const probe = document.createElement('video')
        probe.preload = 'metadata'; probe.src = c.url
        probe.onloadedmetadata = () => {
          c.duration = Number.isFinite(probe.duration) ? probe.duration : 0
          setClips(old => old.map(x => x.id === c.id ? {...x, duration:c.duration} : x))
          if (!selected) setSelected(c.id)
        }
      }
    })
    setClips(old => [...old, ...next])
    if (!selected && next.length) setSelected(next.find(c=>c.kind==='video')?.id || next[0].id)
  }

  const togglePlay = async () => {
    const v = videoRef.current
    if (!v || !active || active.kind !== 'video') return
    if (v.paused) { await v.play(); setPlaying(true) } else { v.pause(); setPlaying(false) }
  }

  const splitClip = () => {
    if (!active || active.kind !== 'video' || current <= 0 || current >= active.duration) return
    setAiText('Split point marked at ' + fmt(current) + '. The source media remains unchanged; use trim controls to export a selected range.')
  }

  const loadFFmpeg = async () => {
    if (ffmpegRef.current?.loaded) return ffmpegRef.current
    const ff = new FFmpeg()
    ff.on('log', ({message}) => setExportStatus(message.slice(0,100)))
    const base = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd'
    await ff.load({ coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'), wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm') })
    ffmpegRef.current = ff; setFfmpegReady(true); return ff
  }

  const exportVideo = async () => {
    if (!active || active.kind !== 'video') { setExportStatus('Select a video clip to export.'); return }
    setExporting(true); setExportStatus('Loading video engine…')
    try {
      const ff = await loadFFmpeg()
      const input = `input-${active.id}.${active.file.name.split('.').pop()?.replace(/[^a-z0-9]/gi,'') || 'mp4'}`
      await ff.writeFile(input, await fetchFile(active.file))
      const output = `pk-editor-${Date.now()}.mp4`
      const start = Math.max(0, trimStart)
      const end = Math.min(active.duration || trimEnd, trimEnd || active.duration)
      const args = ['-ss', String(start), '-i', input, '-t', String(Math.max(0.1,end-start)), '-vf', `setpts=PTS/${speed}`, '-af', `volume=${volume/100},atempo=${speed}`, '-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart', output]
      setExportStatus('Rendering MP4…')
      await ff.exec(args)
      const data = await ff.readFile(output)
      const blob = new Blob([data], {type:'video/mp4'})
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href=url; a.download=`${projectName.replace(/[^a-z0-9-_]/gi,'-')}.mp4`; a.click()
      setExportStatus('Export complete — MP4 downloaded.')
    } catch (e) {
      console.error(e); setExportStatus('Export failed. Try a supported MP4/WebM source and check browser memory/network permissions.')
    } finally { setExporting(false) }
  }

  const autoCaptions = () => {
    const w = window as any
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SpeechRecognition) { setCaptionText('Speech recognition is not supported in this browser. Try Chrome on Android or desktop.'); return }
    setAiBusy(true); setCaptionText('Listening… play your video and speak/audio will be transcribed where browser speech recognition can hear it.')
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'; recognition.continuous = true; recognition.interimResults = true
    recognition.onresult = (event: any) => {
      let text = ''
      for (let i=0;i<event.results.length;i++) text += event.results[i][0].transcript + (event.results[i].isFinal ? '\n' : ' ')
      setCaptionText(text)
    }
    recognition.onerror = () => { setAiBusy(false); setCaptionText(t => t + '\nSpeech recognition stopped or unavailable.') }
    recognition.onend = () => setAiBusy(false)
    recognition.start()
    setTimeout(() => { try { recognition.stop() } catch {} }, 30000)
  }

  const removeClip = (id: string) => {
    const c = clips.find(x=>x.id===id); if (c) URL.revokeObjectURL(c.url)
    setClips(old=>old.filter(x=>x.id!==id))
    if (selected===id) setSelected(clips.find(x=>x.id!==id && x.kind==='video')?.id || '')
  }

  return <div className={`app ${theme}`}>
    <header className="topbar">
      <div className="brand"><div className="brand-icon"><Clapperboard size={21}/></div><div><strong>PK <span>EDITOR</span></strong><small>CREATE • EDIT • TRANSFORM</small></div></div>
      <input className="project-name" value={projectName} onChange={e=>setProjectName(e.target.value)} aria-label="Project name"/>
      <div className="top-actions">
        <button className="icon-btn" onClick={()=>setTheme(theme==='dark'?'light':'dark')} title="Toggle theme">{theme==='dark'?<Sun/>:<Moon/>}</button>
        <button className="secondary-btn" onClick={()=>fileInput.current?.click()}><Upload size={16}/> Import</button>
        <button className="primary-btn" disabled={exporting || !active} onClick={exportVideo}><Download size={16}/> {exporting?'Exporting…':'Export'}</button>
      </div>
      <input ref={fileInput} hidden type="file" accept="video/*,image/*" multiple onChange={e=>addFiles(e.target.files)}/>
      <input ref={audioInput} hidden type="file" accept="audio/*" multiple onChange={e=>addFiles(e.target.files,'audio')}/>
    </header>

    <main className="workspace">
      <aside className="left-panel">
        <div className="panel-heading"><span>MEDIA LIBRARY</span><button className="tiny-icon" onClick={()=>fileInput.current?.click()}><Plus size={16}/></button></div>
        <button className="import-card" onClick={()=>fileInput.current?.click()}><FolderOpen size={23}/><b>Import media</b><small>Video, images and audio</small></button>
        <div className="media-list">
          {clips.map(c=><div key={c.id} className={`media-item ${selected===c.id?'chosen':''}`} onClick={()=>c.kind!=='audio'&&setSelected(c.id)}>
            <div className="media-thumb">{c.kind==='audio'?<AudioLines/>:c.kind==='image'?<ImagePlus/>:<Film/>}</div>
            <div className="media-info"><b title={c.name}>{c.name}</b><small>{c.kind.toUpperCase()} · {fmt(c.duration)}</small></div>
            <button className="tiny-icon remove" onClick={e=>{e.stopPropagation();removeClip(c.id)}}><X size={14}/></button>
          </div>)}
          {!clips.length && <div className="empty-hint">Your imported files will appear here.</div>}
        </div>
        <div className="storage-note"><Check size={14}/> Media stays on this device until you export or choose to share it.</div>
      </aside>

      <section className="center-panel">
        <div className="panel-heading"><span>PREVIEW MONITOR</span><span className="muted">16:9 · {active?.kind==='video'?'SOURCE':'READY'}</span></div>
        <div className="preview-wrap">
          {active?.kind==='video' ? <div className="video-stage">
            <video ref={videoRef} onClick={togglePlay} playsInline />
            {showTitle && titleText && <div className="preview-title">{titleText}</div>}
            {!playing && <button className="big-play" onClick={togglePlay}><Play fill="currentColor"/></button>}
          </div> : active?.kind==='image' ? <div className="image-stage"><img src={active.url}/></div> : <div className="preview-empty"><Clapperboard size={46}/><b>PK Editor</b><span>Import a video to start creating</span><button className="primary-btn" onClick={()=>fileInput.current?.click()}><Upload size={16}/> Choose video</button></div>}
        </div>
        <div className="transport">
          <button className="icon-btn" onClick={()=>{if(videoRef.current)videoRef.current.currentTime=0}}><span>↤</span></button>
          <button className="play-btn" onClick={togglePlay}>{playing?<span>Ⅱ</span>:<Play size={17} fill="currentColor"/>}</button>
          <span className="timecode">{fmt(current)} <i>/</i> {fmt(active?.duration||0)}</span>
          <div className="transport-spacer"/>
          <label className="compact-control"><Gauge size={15}/><select value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label>
        </div>
      </section>

      <aside className="right-panel">
        <div className="panel-heading"><span>EDITING TOOLS</span><Settings2 size={16}/></div>
        <div className="tool-section">
          <h3><Scissors size={16}/> Trim & speed</h3>
          <label className="field-label">Start · {fmt(trimStart)}</label>
          <input type="range" min="0" max={Math.max(1,active?.duration||1)} step="0.1" value={Math.min(trimStart,active?.duration||1)} onChange={e=>setTrimStart(Math.min(Number(e.target.value),trimEnd-0.1))}/>
          <label className="field-label">End · {fmt(trimEnd)}</label>
          <input type="range" min="0" max={Math.max(1,active?.duration||1)} step="0.1" value={Math.min(trimEnd,active?.duration||1)} onChange={e=>setTrimEnd(Math.max(Number(e.target.value),trimStart+0.1))}/>
          <button className="secondary-btn full" onClick={splitClip}><Scissors size={15}/> Mark split point</button>
        </div>
        <div className="tool-section">
          <h3><Volume2 size={16}/> Audio</h3>
          <label className="field-label">Clip volume · {volume}%</label>
          <input type="range" min="0" max="150" value={volume} onChange={e=>setVolume(Number(e.target.value))}/>
          <button className="secondary-btn full" onClick={()=>audioInput.current?.click()}><Music2 size={15}/> Add music / audio</button>
        </div>
        <div className="tool-section">
          <h3><Type size={16}/> Text overlay</h3>
          <input className="text-input" placeholder="Type a title…" value={titleText} onChange={e=>setTitleText(e.target.value)}/>
          <label className="check-row"><input type="checkbox" checked={showTitle} onChange={e=>setShowTitle(e.target.checked)}/> Show title in preview</label>
        </div>
        <div className="tool-section ai-section">
          <h3><WandSparkles size={16}/> AI studio <span className="ai-tag">BETA</span></h3>
          <button className="ai-button" onClick={autoCaptions} disabled={aiBusy}><Captions size={16}/>{aiBusy?'Listening…':'Generate speech captions'}</button>
          <textarea value={captionText} onChange={e=>setCaptionText(e.target.value)} placeholder="Generated transcript will appear here…" rows={4}/>
          <small className="muted">Uses browser speech recognition where supported. For accurate offline transcription or AI background removal, connect a dedicated model/API in a later version.</small>
        </div>
      </aside>
    </main>

    <section className="timeline-panel">
      <div className="timeline-top"><div><Layers size={17}/><b>TIMELINE</b><span className="muted">· {clips.length} assets</span></div><div className="timeline-actions"><button className="tiny-action" onClick={()=>fileInput.current?.click()}><Plus size={14}/> Add clip</button><button className="tiny-action" onClick={()=>audioInput.current?.click()}><Music2 size={14}/> Add audio</button></div></div>
      <div className="ruler"><span>00:00</span><span>00:10</span><span>00:20</span><span>00:30</span><span>00:40</span><span>00:50</span><span>01:00</span></div>
      <div className="track-row"><div className="track-label">VIDEO <Film size={13}/></div><div className="track-content">{videoClips.map(c=><button key={c.id} className={`timeline-clip ${selected===c.id?'selected':''}`} style={{width:`${Math.max(90,Math.min(260,c.duration*5))}px`}} onClick={()=>setSelected(c.id)}><span>{c.kind==='image'?<ImagePlus size={13}/>:<Film size={13}/>}</span>{c.name}</button>)}{!videoClips.length&&<span className="track-placeholder">Import video clips to build your timeline</span>}</div></div>
      <div className="track-row"><div className="track-label">AUDIO <AudioLines size={13}/></div><div className="track-content audio-track">{clips.filter(c=>c.kind==='audio').map(c=><div className="audio-clip" key={c.id}><AudioLines size={14}/>{c.name}</div>)}{!clips.some(c=>c.kind==='audio')&&<span className="track-placeholder">Add music or voiceover</span>}</div></div>
      <div className="timeline-foot"><span>Project duration: {fmt(totalDuration)}</span><span>Local editing workspace · PK Editor 1.0</span></div>
    </section>
    {exportStatus && <div className="status-toast"><span>{exportStatus}</span><button onClick={()=>setExportStatus('')}><X size={14}/></button></div>}
    <footer>PK EDITOR <span>·</span> Your creative workspace <span className="footer-right">Built for creators</span></footer>
  </div>
}
