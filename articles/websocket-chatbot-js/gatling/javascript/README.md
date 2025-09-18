# Gatling JavaScript WebSocket Demo

A showcase of the WebSocket testing using Gatling's JavaScript SDK. Please also check out the [introduction to JavaScript scripting](https://docs.gatling.io/tutorials/scripting-intro-js/) in the Gatling documentation.

## Prerequisites

You need [Node.js](https://nodejs.org/en/download) v18 or later (LTS versions only) and npm v8 or later (included with Node.js).

## Use WebSocket demo project

Run the JavaScript sample test:

```shell
cd javascript
npm install
npx gatling run --simulation basicSimulation # automatically download Gatling runtime, build the project, and run the basicSimulation simulation
```

The `gatling` command-line tool has a built-in help function:

```shell
npx gatling --help # List all available commands
npx gatling run --help # List options for the "run" command (--help also works for all other available commands)
```

## Included helper scripts

Note that both sample projects include a few aliases in the `package.json`'s `scripts` section, which you can use for convenience or refer to as examples:

```shell
npm run clean # Delete Gatling bundled code and generated reports
npm run format # Format code with prettier
npm run build # Build project but don't run
npm run basicSimulation # Run the included basicSimulation simulation
```

## Keep learning

Here are 2 challenges to help you expand your websocket testing skills:

1. **Add more specific response validation:**: Enhance the simulation by adding more specific checks for the chatbot's responses. For example, check if the response contains certain keywords or phrases that are expected based on the question asked.

2. **Implement Error Handling**: Enhance the simulation by implementing error handling for websocket connections. Simulate scenarios where the connection drops or the server returns an error message.

Send your solutions to Marketing@gatling.io for a chance to win some company swag. 