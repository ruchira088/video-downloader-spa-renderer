import React, {useState, useEffect} from "react"
import axios from "axios"
import "./App.css"
import {Maybe, None, Some} from "monet"
import moment from "moment"

const App = (props: { maybeTimestamp: Maybe<moment.Moment> }) => {
    const [label, setLabel] = useState<Maybe<{input: string}>>(None())

    useEffect(() => {
        const id =
            setTimeout(
                () => axios.get("/response.json").then(response => setLabel(Some(response.data))),
                1000
            )

        return () => clearTimeout(id)
    }, [])

    return (
        <div id="app">
            <div className="header">
                <h1>Test Page</h1>
            </div>
            <div className="content">
                <div id="build-timestamp">
                    <span>Build Timestamp: </span>
                    <span>{ props.maybeTimestamp.map(timestamp => timestamp.toISOString()).orJust("Unknown") }</span>
                </div>
                <div id="text-field">ID specified</div>
                <div className="class-name">Class specified</div>
                { label.map(({input}) => <div className="deferred-class-name">{ input }</div>).orNull() }
            </div>
        </div>
    )
}

export default App
