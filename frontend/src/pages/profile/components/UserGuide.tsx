import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Shield, Users, BookOpen, Play, CheckCircle, Settings, LayoutDashboard, FileText } from "lucide-react"
import { useTranslation } from "react-i18next"

interface UserGuideProps {
    role: string
}

export function UserGuide({ role }: UserGuideProps) {
    const { t } = useTranslation()

    const getGuideContent = () => {
        switch (role) {
            case 'ADMIN':
                return {
                    title: t('user_guide.admin.title'),
                    description: t('user_guide.admin.description'),
                    icon: <Shield className="h-5 w-5 text-red-500" />,
                    sections: [
                        {
                            title: t('user_guide.admin.sections.system_management.title'),
                            icon: <Settings className="h-4 w-4" />,
                            content: t('user_guide.admin.sections.system_management.content')
                        },
                        {
                            title: t('user_guide.admin.sections.user_management.title'),
                            icon: <Users className="h-4 w-4" />,
                            content: t('user_guide.admin.sections.user_management.content')
                        },
                        {
                            title: t('user_guide.admin.sections.project_oversight.title'),
                            icon: <LayoutDashboard className="h-4 w-4" />,
                            content: t('user_guide.admin.sections.project_oversight.content')
                        }
                    ]
                }
            case 'TEAM_LEADER':
                return {
                    title: t('user_guide.team_leader.title'),
                    description: t('user_guide.team_leader.description'),
                    icon: <Users className="h-5 w-5 text-blue-500" />,
                    sections: [
                        {
                            title: t('user_guide.team_leader.sections.project_management.title'),
                            icon: <LayoutDashboard className="h-4 w-4" />,
                            content: t('user_guide.team_leader.sections.project_management.content')
                        },
                        {
                            title: t('user_guide.team_leader.sections.test_planning.title'),
                            icon: <FileText className="h-4 w-4" />,
                            content: t('user_guide.team_leader.sections.test_planning.content')
                        },
                        {
                            title: t('user_guide.team_leader.sections.review_approval.title'),
                            icon: <CheckCircle className="h-4 w-4" />,
                            content: t('user_guide.team_leader.sections.review_approval.content')
                        }
                    ]
                }
            case 'TESTER':
                return {
                    title: t('user_guide.tester.title'),
                    description: t('user_guide.tester.description'),
                    icon: <CheckCircle className="h-5 w-5 text-green-500" />,
                    sections: [
                        {
                            title: t('user_guide.tester.sections.test_execution.title'),
                            icon: <Play className="h-4 w-4" />,
                            content: t('user_guide.tester.sections.test_execution.content')
                        },
                        {
                            title: t('user_guide.tester.sections.test_case_creation.title'),
                            icon: <FileText className="h-4 w-4" />,
                            content: t('user_guide.tester.sections.test_case_creation.content')
                        },
                        {
                            title: t('user_guide.tester.sections.automation.title'),
                            icon: <Settings className="h-4 w-4" />,
                            content: t('user_guide.tester.sections.automation.content')
                        }
                    ]
                }
            default:
                return {
                    title: t('profile.user_guide'),
                    description: t('profile.user_guide_desc'),
                    icon: <BookOpen className="h-5 w-5" />,
                    sections: []
                }
        }
    }

    const content = getGuideContent()

    return (
        <Card className="mt-6 border-primary/10 shadow-md">
            <CardHeader className="bg-muted/30 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-background rounded-lg border shadow-sm">
                        {content.icon}
                    </div>
                    <div>
                        <CardTitle className="text-xl">{content.title}</CardTitle>
                        <CardDescription>{content.description}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Accordion type="single" collapsible className="w-full">
                    {content.sections.map((section, index) => (
                        <AccordionItem key={index} value={`item-${index}`} className="px-6 border-b last:border-0">
                            <AccordionTrigger className="hover:no-underline py-4">
                                <div className="flex items-center gap-3 text-sm font-medium">
                                    <div className="text-muted-foreground">
                                        {section.icon}
                                    </div>
                                    {section.title}
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground leading-relaxed pb-4 pl-7">
                                {section.content}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
    )
}
