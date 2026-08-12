import { type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

interface PermissionGateProps {
    permission: string;
    children: ReactNode;
    fallback?: ReactNode;
    projectId?: string;
}

export function PermissionGate({ permission, children, fallback = null, projectId: projectIdOverride }: PermissionGateProps) {
    const checkPermission = useAuthStore((state) => state.checkPermission);
    const { projectId: routeProjectId } = useParams<{ projectId: string }>();
    const projectId = projectIdOverride ?? routeProjectId;

    // If we are not in a project context, we can't check project permissions.
    // Default to false or maybe check global permissions?
    // For now, require projectId.
    if (!projectId) {
        // If no project context, maybe we shouldn't render?
        // Or strictly block.
        return <>{fallback}</>;
    }

    const hasPermission = checkPermission(projectId, permission);

    if (!hasPermission) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}
