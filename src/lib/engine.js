// Which model answers. On Auto, each call takes the next one in turn, so a conversation uses all of them.
const TURNS = ['open', 'modal', 'spark']
let turn = 0
export const pickEngine = (choice) => (choice === 'auto' ? TURNS[turn++ % TURNS.length] : choice)
