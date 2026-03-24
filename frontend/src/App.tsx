import { Canvas, useFrame } from '@react-three/fiber'
import { Float, OrbitControls, Sparkles, Stars, Text } from '@react-three/drei'
import { useMemo, useRef, useState } from 'react'
import type { Group, Mesh } from 'three'

type WordData = {
  word: string
  weight: number
}

type AnalyzeApiResponse = {
  words: WordData[]
}

type ApiErrorResponse = {
  detail?: string
}

const SAMPLE_URLS = [
  'https://www.bbc.com/news',
  'https://www.reuters.com/world/',
  'https://www.theguardian.com/world',
]

const MOCK_WORDS: WordData[] = [
  { word: 'economy', weight: 0.92 },
  { word: 'policy', weight: 0.81 },
  { word: 'markets', weight: 0.75 },
  { word: 'inflation', weight: 0.69 },
  { word: 'growth', weight: 0.63 },
  { word: 'energy', weight: 0.58 },
  { word: 'global', weight: 0.52 },
]

function HaloRings() {
  const outerRing = useRef<Mesh | null>(null)
  const innerRing = useRef<Mesh | null>(null)

  useFrame((_state, delta) => {
    if (outerRing.current) {
      outerRing.current.rotation.z += delta * 0.12
      outerRing.current.rotation.x += delta * 0.05
    }

    if (innerRing.current) {
      innerRing.current.rotation.z -= delta * 0.18
      innerRing.current.rotation.y += delta * 0.09
    }
  })

  return (
    <>
      <mesh ref={outerRing} rotation={[Math.PI / 2.6, 0, 0]}>
        <torusGeometry args={[4.6, 0.04, 12, 200]} />
        <meshStandardMaterial color="#4bc5ff" emissive="#1b5da6" emissiveIntensity={0.7} />
      </mesh>
      <mesh ref={innerRing} rotation={[Math.PI / 3.5, Math.PI / 4, 0]}>
        <torusGeometry args={[3.3, 0.03, 12, 160]} />
        <meshStandardMaterial color="#82ffe9" emissive="#17655b" emissiveIntensity={0.5} />
      </mesh>
    </>
  )
}

function WordCluster({
  words,
  activeWord,
  onWordHover,
}: {
  words: WordData[]
  activeWord: string | null
  onWordHover: (word: WordData | null) => void
}) {
  const cloudRef = useRef<Group | null>(null)
  const positions = useMemo(
    () =>
      words.map((_, index) => {
        const ratio = index / words.length
        const phi = Math.acos(1 - 2 * ratio)
        const theta = Math.sqrt(words.length * Math.PI * 2) * phi
        const radius = 2.9 + (index % 5) * 0.45

        return [
          radius * Math.cos(theta) * Math.sin(phi),
          radius * Math.sin(theta) * Math.sin(phi),
          radius * Math.cos(phi),
        ] as [number, number, number]
      }),
    [words],
  )

  useFrame((_state, delta) => {
    if (cloudRef.current) {
      cloudRef.current.rotation.y += delta * 0.15
      cloudRef.current.rotation.x += delta * 0.05
    }
  })

  return (
    <group ref={cloudRef}>
      {words.map((entry, index) => (
        <Float
          key={entry.word}
          speed={1 + entry.weight}
          rotationIntensity={0.35}
          floatIntensity={0.9}
        >
          <Text
            position={positions[index]}
            fontSize={0.3 + entry.weight * 0.72}
            color={`hsl(${205 - index * 10}, 76%, ${56 + entry.weight * 18}%)`}
            anchorX="center"
            anchorY="middle"
            onPointerOver={(event) => {
              event.stopPropagation()
              onWordHover(entry)
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              onWordHover(null)
              document.body.style.cursor = 'default'
            }}
            scale={activeWord === entry.word ? 1.2 : 1}
          >
            {entry.word}
          </Text>
        </Float>
      ))}
    </group>
  )
}

function App() {
  const apiBaseUrl =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
    'http://127.0.0.1:8000'
  const [url, setUrl] = useState(SAMPLE_URLS[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [words, setWords] = useState<WordData[]>(MOCK_WORDS)
  const [activeWord, setActiveWord] = useState<WordData | null>(null)

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)

    try {
      if (!url.startsWith('http')) {
        throw new Error('Please enter a valid article URL.')
      }

      const response = await fetch(`${apiBaseUrl}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        const errorPayload = (await response.json()) as ApiErrorResponse
        throw new Error(errorPayload.detail ?? 'Analysis request failed')
      }

      const payload = (await response.json()) as AnalyzeApiResponse

      if (!payload.words || payload.words.length === 0) {
        throw new Error('No keywords were returned for this article.')
      }

      setWords(payload.words)
      setActiveWord(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error'
      setError(message)
      setWords(MOCK_WORDS)
      setActiveWord(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="panel">
        <p className="eyebrow">News Topic Visualizer</p>
        <h1>3D Word Cloud</h1>
        <p className="description">
          Enter a news article URL and generate an interactive cloud of the most
          relevant topics.
        </p>

        <div className="controls">
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            list="sample-urls"
            aria-label="Article URL"
            placeholder="https://example.com/news-article"
          />
          <datalist id="sample-urls">
            {SAMPLE_URLS.map((sampleUrl) => (
              <option value={sampleUrl} key={sampleUrl} />
            ))}
          </datalist>

          <button onClick={handleAnalyze} disabled={loading}>
            {loading ? 'Analyzing...' : 'Analyze Article'}
          </button>
        </div>

        {error && <p className="error">{error}</p>}
        {!error && !loading && <p className="result-info">Loaded {words.length} topics.</p>}

        <div className="active-word-card">
          <p className="active-label">Selected Topic</p>
          <p className="active-word">{activeWord?.word ?? 'Hover a word in the cloud'}</p>
          <p className="active-score">
            Relevance: {activeWord ? `${Math.round(activeWord.weight * 100)}%` : '--'}
          </p>
        </div>
      </header>

      <section className="scene-wrap">
        <Canvas camera={{ position: [0, 0, 9], fov: 55 }}>
          <color attach="background" args={['#050813']} />
          <fog attach="fog" args={['#050813', 8, 19]} />
          <ambientLight intensity={0.7} />
          <directionalLight position={[2, 3, 4]} intensity={1.5} />
          <pointLight position={[-4, -1, 2]} intensity={1.2} color="#5ec8ff" />
          <Stars radius={80} depth={40} count={2200} factor={5} saturation={0.2} fade speed={0.55} />
          <Sparkles count={90} scale={10} size={2.6} speed={0.35} color="#66d9ff" />
          <HaloRings />
          <WordCluster
            words={words}
            activeWord={activeWord?.word ?? null}
            onWordHover={setActiveWord}
          />
          <OrbitControls
            enablePan={false}
            maxDistance={12}
            minDistance={6}
            autoRotate
            autoRotateSpeed={0.4}
          />
        </Canvas>
      </section>
    </div>
  )
}

export default App
