/**
 * Optional read-out of the battle log. Off by default: an offline device may
 * have no voices installed, and the log always carries the same information.
 */
export function speak(text: string, enabled: boolean): boolean {
	if (!enabled) return false;
	try {
		const synth = (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
		const Utterance = (
			globalThis as { SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance }
		).SpeechSynthesisUtterance;
		if (!synth || !Utterance) return false;

		const utterance = new Utterance(text);
		utterance.rate = 1.1;
		synth.speak(utterance);
		return true;
	} catch {
		// No voices, blocked API, or a headless environment: the log stands alone.
		return false;
	}
}
