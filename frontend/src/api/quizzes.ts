import { apiClient } from "./client";
import type { Quiz } from "../types";

export interface QuestionInput {
  text: string;
  time_limit: number;
  order: number;
  options: { text: string; is_correct: boolean }[];
}

export interface QuizInput {
  title: string;
  questions: QuestionInput[];
}

export async function listQuizzes(): Promise<Quiz[]> {
  const { data } = await apiClient.get<Quiz[]>("/quizzes");
  return data;
}

export async function getQuiz(id: string): Promise<Quiz> {
  const { data } = await apiClient.get<Quiz>(`/quizzes/${id}`);
  return data;
}

export async function createQuiz(input: QuizInput): Promise<{ id: string; title: string }> {
  const { data } = await apiClient.post<{ id: string; title: string }>("/quizzes", input);
  return data;
}

export async function updateQuiz(id: string, input: QuizInput): Promise<{ id: string; title: string }> {
  const { data } = await apiClient.put<{ id: string; title: string }>(`/quizzes/${id}`, input);
  return data;
}

export async function deleteQuiz(id: string): Promise<void> {
  await apiClient.delete(`/quizzes/${id}`);
}
