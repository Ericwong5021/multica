package handler

import (
	"net/http"
	"strings"

	"github.com/multica-ai/multica/server/internal/governance"
)

type GovernancePolicyResponse struct {
	WorkspaceID   string                        `json:"workspace_id"`
	ActorUserID   string                        `json:"actor_user_id"`
	WorkspaceRole string                        `json:"workspace_role"`
	Approved      bool                          `json:"approved"`
	Roles         []governance.RoleTemplate     `json:"roles"`
	Actions       []governance.Action           `json:"actions"`
	Decisions     []governance.Decision         `json:"decisions"`
}

func (h *Handler) GetGovernancePolicy(w http.ResponseWriter, r *http.Request) {
	workspaceID := h.resolveWorkspaceID(r)
	member, ok := h.requireWorkspaceMember(w, r, workspaceID, "workspace not found")
	if !ok {
		return
	}

	approved := strings.EqualFold(r.URL.Query().Get("approved"), "true")
	ctx := governance.Context{
		WorkspaceRole: member.Role,
		Approved:      approved,
	}

	writeJSON(w, http.StatusOK, GovernancePolicyResponse{
		WorkspaceID:   uuidToString(member.WorkspaceID),
		ActorUserID:   uuidToString(member.UserID),
		WorkspaceRole: member.Role,
		Approved:      approved,
		Roles:         governance.RoleTemplates(),
		Actions:       governance.Actions(),
		Decisions:     governance.EvaluateAll(ctx),
	})
}
