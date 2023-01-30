import { test } from "@hazae41/phobos";
import { relative, resolve } from "path";
import { AsyncEventTarget } from "./target.js";

const directory = resolve("./dist/test/")
const { pathname } = new URL(import.meta.url)
console.log(relative(directory, pathname.replace(".mjs", ".ts")))

test("AsyncEventTarget", async ({ test }) => {
  const target = new AsyncEventTarget()

  target.addEventListener("test", async () => {
    console.log("first")
  }, { passive: true })

  target.addEventListener("test", async () => {
    console.log("second")
  }, { passive: true })

  const event = new Event("test")
  await target.dispatchEvent(event)

  console.log("done")
})