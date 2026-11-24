import { issueKey } from '../../../commons/utils/issue-key';
import { actorDto } from '../../../commons/mappers/user.mapper';
export const commentDto = (c: any) => ({
  id: c.id,
  issueKey: issueKey(c.issue?.issueNumber ?? 0),
  content: c.content,
  author: actorDto(c.author),
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
  isEdited: c.updatedAt.getTime() - c.createdAt.getTime() > 1000,
});
