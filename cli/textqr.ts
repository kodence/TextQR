import { run, type Io } from './main'

const io: Io = {
  stdout: (chunk) => {
    process.stdout.write(chunk)
  },
  stderr: (chunk) => {
    process.stderr.write(chunk)
  },
  stdin: async () => {
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
    return new Uint8Array(Buffer.concat(chunks))
  },
}

process.exitCode = await run(process.argv.slice(2), io)
