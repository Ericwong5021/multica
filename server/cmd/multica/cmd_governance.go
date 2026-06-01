package main

import (
	"context"
	"fmt"
	"os"
	"text/tabwriter"
	"time"

	"github.com/spf13/cobra"

	"github.com/multica-ai/multica/server/internal/cli"
)

var governanceCmd = &cobra.Command{
	Use:   "governance",
	Short: "Inspect workspace governance permissions",
}

var governancePolicyCmd = &cobra.Command{
	Use:   "policy",
	Short: "Show the governance policy matrix and current actor decisions",
	RunE:  runGovernancePolicy,
}

type governancePolicyResponse struct {
	WorkspaceID   string               `json:"workspace_id"`
	ActorUserID   string               `json:"actor_user_id"`
	WorkspaceRole string               `json:"workspace_role"`
	Approved      bool                 `json:"approved"`
	Roles         []governanceRole      `json:"roles"`
	Actions       []governanceAction    `json:"actions"`
	Decisions     []governanceDecision  `json:"decisions"`
}

type governanceRole struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Domains     []string `json:"domains"`
}

type governanceAction struct {
	ID          string `json:"id"`
	Domain      string `json:"domain"`
	Strategy    string `json:"strategy"`
	Description string `json:"description"`
	Audit       bool   `json:"audit"`
}

type governanceDecision struct {
	ActionID         string `json:"action_id"`
	Domain           string `json:"domain"`
	Strategy         string `json:"strategy"`
	Allowed          bool   `json:"allowed"`
	RequiresApproval bool   `json:"requires_approval"`
	Reason           string `json:"reason"`
	Audit            bool   `json:"audit"`
}

func init() {
	governanceCmd.AddCommand(governancePolicyCmd)

	governancePolicyCmd.Flags().String("output", "table", "Output format: table or json")
	governancePolicyCmd.Flags().Bool("approved", false, "Evaluate approval-required actions as if an approval source has already been recorded")
}

func runGovernancePolicy(cmd *cobra.Command, _ []string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	client, err := newAPIClient(cmd)
	if err != nil {
		return err
	}

	approved, _ := cmd.Flags().GetBool("approved")
	path := "/api/governance/policy"
	if approved {
		path += "?approved=true"
	}

	var resp governancePolicyResponse
	if err := client.GetJSON(ctx, path, &resp); err != nil {
		return err
	}

	output, _ := cmd.Flags().GetString("output")
	if output == "json" {
		return cli.PrintJSON(os.Stdout, resp)
	}

	printGovernancePolicyTable(resp)
	return nil
}

func printGovernancePolicyTable(resp governancePolicyResponse) {
	fmt.Fprintf(os.Stdout, "Workspace: %s\nRole: %s\nApproved context: %t\n\n", resp.WorkspaceID, resp.WorkspaceRole, resp.Approved)

	fmt.Fprintln(os.Stdout, "Role templates:")
	roleWriter := tabwriter.NewWriter(os.Stdout, 0, 4, 2, ' ', 0)
	fmt.Fprintln(roleWriter, "ID\tDOMAINS\tDESCRIPTION")
	for _, role := range resp.Roles {
		fmt.Fprintf(roleWriter, "%s\t%d\t%s\n", role.ID, len(role.Domains), role.Description)
	}
	_ = roleWriter.Flush()

	fmt.Fprintln(os.Stdout, "\nDecisions:")
	decisionWriter := tabwriter.NewWriter(os.Stdout, 0, 4, 2, ' ', 0)
	fmt.Fprintln(decisionWriter, "ACTION\tDOMAIN\tSTRATEGY\tALLOWED\tAPPROVAL\tAUDIT\tREASON")
	for _, decision := range resp.Decisions {
		fmt.Fprintf(decisionWriter, "%s\t%s\t%s\t%t\t%t\t%t\t%s\n",
			decision.ActionID,
			decision.Domain,
			decision.Strategy,
			decision.Allowed,
			decision.RequiresApproval,
			decision.Audit,
			decision.Reason,
		)
	}
	_ = decisionWriter.Flush()
}
