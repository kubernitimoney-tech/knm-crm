export const EMPLOYEE_MOTIVATION_LINES = [
  "Every lead you nurture has the potential to transform a client's life.",
  'Precise actions today ensure trust in our sanctions tomorrow.',
  'Every follow-up today unlocks a financial breakthrough for your client tomorrow.',
  'Small actions on each case create big wins for the team.',
  'Discipline in the portal reflects excellence in the field.',
  'One verified document at a time — that is how we move faster together.',
  'Great teams are built on ownership; you own the next step on every lead.',
  'Customer experience is defined by how we treat them—and you define that experience.',
] as const;

export const EMPLOYEE_MOTIVATION_HIGHLIGHTS = [
  'You are the face of our lending promise.',
  'Accuracy and empathy go hand in hand.',
  'Together we turn enquiries into confident disbursals.',
] as const;

export function pickEmployeeMotivationLine(
  lines: readonly string[] = EMPLOYEE_MOTIVATION_LINES,
): string {
  return lines[Math.floor(Math.random() * lines.length)];
}
