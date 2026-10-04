// Tokenize SSH parameters without evaluating a local shell, variables, or substitutions.
export function splitSshArguments(input: string): string[] {
  const result: string[] = [];
  let word = '', quote = '', started = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '\\' && quote !== "'") {
      if (++i === input.length) throw new Error('Trailing escape in sshCustomParams');
      word += input[i];
      started = true;
    } else if (quote) {
      if (char === quote) quote = '';
      else word += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started) result.push(word);
      word = ''; started = false;
    } else {
      word += char; started = true;
    }
  }
  if (quote) throw new Error('Unclosed quote in sshCustomParams');
  if (started) result.push(word);
  return result;
}
