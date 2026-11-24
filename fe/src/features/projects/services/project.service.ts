import { get, mutate, type Project } from '../../../shared/api/index';

export function fetchProjects() {
  return get<Project[]>('/projects');
}

export function createProject(data: { name: string; slug?: string; description?: string | null }) {
  return mutate<Project>('/projects', 'POST', data);
}

export function updateProject(slug: string, data: { name?: string; description?: string | null }) {
  return mutate<Project>(`/projects/${slug}`, 'PATCH', data);
}

export function deleteProject(slug: string) {
  return mutate<void>(`/projects/${slug}`, 'DELETE');
}
