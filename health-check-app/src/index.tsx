import React from "react"
import ReactDOM from "react-dom/client"
import "./index.css"
import App from "./App"
import {Maybe} from "monet"
import moment from "moment"

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement)

const maybeBuildTimestamp: Maybe<moment.Moment> =
    Maybe.fromNull(process.env.REACT_APP_BUILD_TIMESTAMP)
        .map(stringValue => moment(stringValue))
        .filter(timestamp => timestamp.isValid())

root.render(
    <React.StrictMode>
        <App maybeTimestamp={maybeBuildTimestamp}/>
    </React.StrictMode>
)