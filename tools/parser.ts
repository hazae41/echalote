function parse(text: string) {
  text = text.replaceAll("vec!", "")

  text = text.split("\n").map(line => {
    line = line.trim()

    if (line.startsWith("//")) return ""
    if (line.startsWith("/*")) return ""

    line = line.replaceAll("&[", "[")
    line = line.replaceAll("fallback(", "[")
    line = line.replaceAll("),", "],")

    return line
  }).join("")

  text = text.replaceAll(",]", "]")

  const fallbacks: [string, string, boolean, number[], string[]][] = JSON.parse(text)
  const fallbacks2 = fallbacks.map(([id, eid, exit, onion, hosts]) => ({ id, eid, exit, onion, hosts }))

  return JSON.stringify(fallbacks2)
}

const text = await Deno.readTextFile("./fallbacks.inc")
await Deno.writeTextFile("./fallbacks.json", parse(text))
