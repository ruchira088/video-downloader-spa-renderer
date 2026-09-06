import { type FC, useEffect, useState } from "react"
import axios from "axios"

import "./home.css"

const App: FC = () => {
  const [label, setLabel] = useState<string | null>(null)
  const buildTimestamp = import.meta.env.VITE_BUILD_TIMESTAMP || "Unknown"

  useEffect(() => {
    const id = setTimeout(
      () =>
        axios
          .get("/response.json")
          .then((response) => setLabel(response.data.input)),
      100
    )

    return () => clearTimeout(id)
  }, [])

  return (
    <div id="app">
      <div className="header">
        <h1>Test Page</h1>
      </div>
      <div className="content">
        <div>React Router</div>
        <div id="build-timestamp">
          <span>Build Timestamp: </span>
          <span>{buildTimestamp}</span>
        </div>
        <div id="text-field">ID specified</div>
        <div className="class-name">Class specified</div>
        {label && <div className="deferred-class-name">{label}</div>}
      </div>
    </div>
  )
}

export default App
