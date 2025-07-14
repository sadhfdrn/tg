
'use server';
/**
 * @fileOverview A flow to summarize text.
 *
 * - summarizeText - A function that takes text and returns a summary.
 * - SummarizeTextInput - The input type for the summarizeText function.
 * - SummarizeTextOutput - The return type for the summarizeText function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeTextInputSchema = z.object({
  textToSummarize: z.string().describe('The text to be summarized.'),
});
export type SummarizeTextInput = z.infer<typeof SummarizeTextInputSchema>;

const SummarizeTextOutputSchema = z.object({
  summary: z.string().describe('The one-paragraph summary of the text.'),
});
export type SummarizeTextOutput = z.infer<typeof SummarizeTextOutputSchema>;


const summarizePrompt = ai.definePrompt({
  name: 'summarizePrompt',
  input: {schema: SummarizeTextInputSchema},
  output: {schema: SummarizeTextOutputSchema},
  prompt: `Summarize the following text into a single, concise paragraph.

Text to summarize:
{{{textToSummarize}}}`,
});

const summarizeTextFlow = ai.defineFlow(
  {
    name: 'summarizeTextFlow',
    inputSchema: SummarizeTextInputSchema,
    outputSchema: SummarizeTextOutputSchema,
  },
  async (input) => {
    const {output} = await summarizePrompt(input);
    return output!;
  }
);


export async function summarizeText(text: string): Promise<string> {
    const result = await summarizeTextFlow({ textToSummarize: text });
    return result.summary;
}
