import React from "react"
import {render, screen} from "@testing-library/react"
import App from "./App"
import {None} from "monet"

test("Renders expected text", () => {
    render(<App maybeTimestamp={None()}/>)
    expect(screen.getByText("ID specified")).toBeInTheDocument()
    expect(screen.getByText("Class specified")).toBeInTheDocument()
})
