import { operatorLineText } from "./operatorLine"

export default function OperatorLine() {
  const text = operatorLineText()
  if (!text) return null
  return <p className="mt-3">{text}</p>
}
