import { Button } from "@/components/ui/button"
import { useState } from "react"
import { hc } from "hono/client"
import type { AppType } from ".."

const client = hc<AppType>("/")

type AppProps = {
  sessionId: string
}

export default function App({ sessionId }: AppProps) {
  const [count, setCount] = useState(0)

  console.log(client.api) // remove this when writing code using client.api in first-time

  return (
    <div data-session-id={sessionId}>
      <p>Session ID: {sessionId}</p>
      <p>Count: {count}</p>
      <Button onClick={() => setCount(count + 1)}>Increment</Button>
    </div>
  )
}
