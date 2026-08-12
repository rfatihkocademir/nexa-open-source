import { GitCommit, GitMerge, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { GitCommit as GitCommitType, PullRequest as PullRequestType } from "@/types/agile"

interface StoryGitInfoProps {
    gitCommits?: GitCommitType[]
    pullRequests?: PullRequestType[]
}

export function StoryGitInfo({ gitCommits = [], pullRequests = [] }: StoryGitInfoProps) {
    const hasData = gitCommits.length > 0 || pullRequests.length > 0

    if (!hasData) {
        return (
            <section>
                <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                    <GitCommit className="h-3.5 w-3.5" />
                    Source Code Activity
                </h3>
                <p className="text-xs text-muted-foreground italic">
                    No commits or pull requests linked to this item yet.
                </p>
            </section>
        )
    }

    return (
        <section className="space-y-4">
            {/* Commits */}
            {gitCommits.length > 0 && (
                <div>
                    <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                        <GitCommit className="h-3.5 w-3.5" />
                        Commits ({gitCommits.length})
                    </h3>
                    <div className="space-y-1.5">
                        {gitCommits.map((commit) => (
                            <a
                                key={commit.id}
                                href={commit.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-start gap-2 text-xs p-2.5 rounded-md bg-sky-50/50 dark:bg-sky-950/10 border border-sky-100 dark:border-sky-900/20 hover:bg-sky-100/70 dark:hover:bg-sky-900/30 transition-colors group"
                            >
                                <GitCommit className="h-3.5 w-3.5 text-sky-600 mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="font-mono text-[9px] h-4 shrink-0 bg-sky-50 border-sky-200 text-sky-700">
                                            {commit.hash.substring(0, 7)}
                                        </Badge>
                                        <span className="truncate font-medium text-foreground">{commit.message}</span>
                                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto" />
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                                        <span>{commit.authorName}</span>
                                        <span>•</span>
                                        <span>{new Date(commit.date).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* Pull Requests */}
            {pullRequests.length > 0 && (
                <div>
                    <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                        <GitMerge className="h-3.5 w-3.5" />
                        Pull Requests ({pullRequests.length})
                    </h3>
                    <div className="space-y-1.5">
                        {pullRequests.map((pr) => {
                            const stateColor = pr.state === 'merged'
                                ? 'bg-purple-50 border-purple-200 text-purple-700'
                                : pr.state === 'open'
                                    ? 'bg-green-50 border-green-200 text-green-700'
                                    : 'bg-red-50 border-red-200 text-red-700'

                            return (
                                <a
                                    key={pr.id}
                                    href={pr.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group flex items-start gap-2 rounded-md border border-primary/15 bg-primary/5 p-2.5 text-xs transition-colors hover:bg-primary/10"
                                >
                                    <GitMerge className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="h-4 shrink-0 border-primary/20 bg-primary/10 font-mono text-[9px] text-primary">
                                                #{pr.prNumber}
                                            </Badge>
                                            <span className="truncate font-medium text-foreground">{pr.title}</span>
                                            <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto" />
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className={`text-[9px] h-4 ${stateColor}`}>
                                                {pr.state}
                                            </Badge>
                                            <span className="text-muted-foreground">{pr.author}</span>
                                            <span className="text-muted-foreground">•</span>
                                            <span className="text-muted-foreground">
                                                {pr.mergedAt
                                                    ? `Merged ${new Date(pr.mergedAt).toLocaleDateString()}`
                                                    : new Date(pr.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </a>
                            )
                        })}
                    </div>
                </div>
            )}
        </section>
    )
}
