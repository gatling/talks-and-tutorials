# Ecommerce Chatbot

This folder contains the ecommerce chatbot application and the associated Gatling simulation displayed at [AI Developer Meetup @Station F Koyeb](https://lu.ma/vw3dph3f).

## Prerequisites

- Node.js (v14 or higher)
- Ollama installed and running locally
- Mistral model pulled in Ollama (`ollama pull mistral`)
- [Gatling](https://gatling.io)

## Setup

### App

1. Install dependencies:
```bash
npm install
```

2. Start the chatbot:
```bash
npm start
```

### Gatling

1. Install dependencies:
```bash
npm install
```

2. Start the simulation:

```bash
# don't forget to change the URL address in the simulation file
npx gatling run
```

If you have any problem with the application or the simulation, create an issue on this repository.