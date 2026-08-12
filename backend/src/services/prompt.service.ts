import prisma from '../utils/prisma';
import { AppError } from '../utils/AppError';

export interface PromptRenderOptions {
  version?: number;
  fallback?: string;
}

export class PromptService {
  /**
   * Fetches a rendered prompt template with variables replaced.
   * Variables should be in {{variableName}} format.
   */
  async renderPrompt(slug: string, variables: Record<string, any>, options: PromptRenderOptions = {}): Promise<string> {
    const template = await prisma.promptTemplate.findFirst({
      where: { slug, deletedAt: null },
      include: {
        versions: {
          where: options.version ? { version: options.version } : undefined,
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!template || template.versions.length === 0) {
      if (options.fallback) {
        return this.interpolate(options.fallback, variables);
      }
      throw new AppError(`Prompt template "${slug}" not found`, 404);
    }

    // If version not specified, use currentVersion or latest fetched
    const versionToUse = options.version 
      ? template.versions[0] 
      : template.versions.find(v => v.version === template.currentVersion) || template.versions[0];

    return this.interpolate(versionToUse.templateBody, variables);
  }

  /**
   * Interpolates variables into a string.
   * Supports {{key}} syntax.
   */
  private interpolate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
      return Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key]) : match;
    });
  }

  async createTemplate(slug: string, name: string, description?: string) {
    return prisma.promptTemplate.create({
      data: {
        slug,
        name,
        description,
      },
    });
  }

  async addVersion(slug: string, data: {
    templateBody: string;
    inputSchema?: any;
    outputSchema?: any;
    config?: any;
    createdById?: string;
  }) {
    const template = await prisma.promptTemplate.findFirst({
      where: { slug, deletedAt: null },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
    });

    if (!template) {
      throw new AppError(`Prompt template "${slug}" not found`, 404);
    }

    const nextVersion = template.versions.length > 0 ? template.versions[0].version + 1 : 1;

    return prisma.promptVersion.create({
      data: {
        templateId: template.id,
        version: nextVersion,
        templateBody: data.templateBody,
        inputSchema: data.inputSchema || null,
        outputSchema: data.outputSchema || null,
        config: data.config || null,
        createdById: data.createdById,
      },
    });
  }

  async activateVersion(slug: string, version: number) {
    const template = await prisma.promptTemplate.findFirst({
      where: { slug, deletedAt: null },
      include: { versions: { where: { version } } }
    });

    if (!template || template.versions.length === 0) {
      throw new AppError(`Version ${version} for template "${slug}" not found or template is archived`, 404);
    }

    return prisma.promptTemplate.update({
      where: { id: template.id },
      data: { currentVersion: version },
    });
  }

  async listTemplates() {
    return prisma.promptTemplate.findMany({
      where: { deletedAt: null },
      include: {
        _count: { select: { versions: true } }
      }
    });
  }

  async getTemplateDetails(slug: string) {
    return prisma.promptTemplate.findFirst({
      where: { slug, deletedAt: null },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          include: { createdBy: { select: { id: true, firstName: true, lastName: true } } }
        }
      }
    });
  }

  async archiveTemplate(slug: string) {
    const template = await prisma.promptTemplate.findUnique({ where: { slug } });
    if (!template) throw new AppError('Template not found', 404);
    
    return prisma.promptTemplate.update({
      where: { slug },
      data: { deletedAt: new Date() }
    });
  }

  async restoreTemplate(slug: string) {
    const template = await prisma.promptTemplate.findUnique({ where: { slug } });
    if (!template) throw new AppError('Template not found', 404);
    
    return prisma.promptTemplate.update({
      where: { slug },
      data: { deletedAt: null }
    });
  }

  async hardDeleteTemplate(slug: string) {
    const template = await prisma.promptTemplate.findUnique({ where: { slug } });
    if (!template) throw new AppError('Template not found', 404);
    
    return prisma.promptTemplate.delete({
      where: { slug }
    });
  }
}

export const promptService = new PromptService();
