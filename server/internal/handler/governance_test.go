package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGetGovernancePolicyReturnsDecisionMatrix(t *testing.T) {
	req := newRequest(http.MethodGet, "/api/governance/policy", nil)
	req.Header.Set("X-User-ID", testUserID)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)

	w := httptest.NewRecorder()
	testHandler.GetGovernancePolicy(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("GetGovernancePolicy: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp GovernancePolicyResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.WorkspaceID != testWorkspaceID {
		t.Fatalf("workspace_id = %q, want %q", resp.WorkspaceID, testWorkspaceID)
	}
	if resp.WorkspaceRole != "owner" {
		t.Fatalf("workspace_role = %q, want owner", resp.WorkspaceRole)
	}
	if len(resp.Roles) < 5 {
		t.Fatalf("expected role templates, got %d", len(resp.Roles))
	}
	if len(resp.Decisions) == 0 {
		t.Fatal("expected decisions")
	}

	var foundApprovalRequired bool
	for _, decision := range resp.Decisions {
		if decision.ActionID == "agent.create" {
			foundApprovalRequired = true
			if decision.Allowed {
				t.Fatalf("agent.create should not be allowed without approval: %+v", decision)
			}
			if !decision.RequiresApproval || decision.Reason != "approval_required" {
				t.Fatalf("agent.create decision = %+v", decision)
			}
		}
	}
	if !foundApprovalRequired {
		t.Fatal("missing agent.create decision")
	}
}

func TestGetGovernancePolicyApprovedContextAllowsOwnerApprovalActions(t *testing.T) {
	req := newRequest(http.MethodGet, "/api/governance/policy?approved=true", nil)
	req.Header.Set("X-User-ID", testUserID)
	req.Header.Set("X-Workspace-ID", testWorkspaceID)

	w := httptest.NewRecorder()
	testHandler.GetGovernancePolicy(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("GetGovernancePolicy: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp GovernancePolicyResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !resp.Approved {
		t.Fatal("approved context should be true")
	}
	for _, decision := range resp.Decisions {
		if decision.ActionID == "agent.create" && !decision.Allowed {
			t.Fatalf("agent.create should be allowed with owner role and approval: %+v", decision)
		}
	}
}
