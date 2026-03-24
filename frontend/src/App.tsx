import { Canvas, useFrame } from '@react-three/fiber'
import { Float, OrbitControls, Text } from '@react-three/drei'
import { useMemo, useRef, useState } from 'react'
import type { Group } from 'three'

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

function WordCluster({ words }: { words: WordData[] }) {
  const cloudRef = useRef<Group | null>(null)
  const positions = useMemo(
    () =>
      words.map((_, index) => {
        const phi = Math.acos(-1 + (2 * index) / words.length)
        const theta = Math.sqrt(words.length * Math.PI) * phi
        const radius = 3.2 + (index % 3) * 0.5

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
          rotationIntensity={0.2}
          floatIntensity={0.6}
        >
          <Text
            position={positions[index]}
            fontSize={0.35 + entry.weight * 0.55}
            color={`hsl(${205 - index * 10}, 76%, ${56 + entry.weight * 18}%)`}
            anchorX="center"
            anchorY="middle"
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error'
      setError(message)
      setWords(MOCK_WORDS)
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
      </header>

      <section className="scene-wrap">
        <Canvas camera={{ position: [0, 0, 9], fov: 55 }}>
          <color attach="background" args={['#050813']} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[2, 3, 4]} intensity={1.4} />
          <WordCluster words={words} />
          <OrbitControls enablePan={false} maxDistance={12} minDistance={6} />
        </Canvas>
      </section>
    </div>
  )
}

export default App
