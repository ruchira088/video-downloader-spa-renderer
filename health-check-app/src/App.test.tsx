import React from "react"
import {render, screen} from "@testing-library/react"
import App from "./App"

test("renders expected text", () => {
    render(<App/>)
    expect(screen.getByText("ID specified")).toBeInTheDocument()
    expect(screen.getByText("Class specified")).toBeInTheDocument()
})
