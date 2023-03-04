import { assert, test } from "@hazae41/phobos";
import { relative, resolve } from "path";
import { AsyncEventTarget } from "./target.js";

const directory = resolve("./dist/test/")
const { pathname } = new URL(import.meta.url)
console.log(relative(directory, pathname.replace(".mjs", ".ts")))

test("AsyncEventTarget", async ({ test }) => {
  const target = new AsyncEventTarget<{ test: Event }>()

  const stack = new Array<string>()

  target.addEventListener("test", async () => {
    stack.push("first")
  }, { passive: true })

  target.addEventListener("test", async () => {
    stack.push("second")
  }, { passive: true })

  const event = new Event("test")
  await target.dispatchEvent(event, "test")

  stack.push("done")

  assert(stack.length === 3)
  assert(stack[0] === "first")
  assert(stack[1] === "second")
  assert(stack[2] === "done")
})