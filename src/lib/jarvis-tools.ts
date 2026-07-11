import { Type } from '@google/genai';

// In the new GoogleGenAI SDK, google search is often a built-in tool,
// but we define it explicitly if we want to route it manually, 
// OR we just use the built-in `{ "googleSearch": {} }` object in the API call.
// For now, we define our custom tools.

export const jarvisTools = [
  {
    name: 'getCrmOverview',
    description: 'Fetches the current CRM overview including today calls, pipeline numbers, and priority leads.',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: 'getGProjectScore',
    description: 'Fetches Ricos current accountability score, points, and debt from the G Project.',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: 'getTasks',
    description: 'Fetches open tasks from the system. Can optionally filter by project or priority.',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: 'updateMemory',
    description: 'Updates Ricos interests profile and memory. Call this proactively whenever Rico mentions new interests, preferences, or important facts about himself.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        facts: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          },
          description: 'A list of facts or interests to ADD to the memory. Example: ["Interesse für KI Aktien", "Trinkt morgens Kaffee schwarz"]'
        }
      },
      required: ['facts']
    }
  },
  {
    name: 'readMemory',
    description: 'Reads Ricos current interests profile and memory facts.',
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  }
];
