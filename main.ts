#!/usr/bin/env -S rote play run
/**
 * @rote-frontmatter
 * ---
 * name: repository-pulse
 * description: "Summarizes a local Git repository's working tree, recent commits, and tracked TODO markers."
 * provenance:
 *   author: asrafathima0405@gmail.com
 * metadata:
 *   rote_version: 0.82.0
 *   version: 0.0.1
 *   status: released
 *   kind: atomic
 *   flow_type: parallel
 *   execution_model: steps_with_presentation
 *   requires_endpoints: []
 *   requires_sessions: false
 *   contract:
 *     atomic: true
 *     input:
 *       type: none
 *     output:
 *       format: json
 *       destination: stdout
 *     composable: true
 *   hardcode_audit:
 *     schema: 2
 *     suspicion_count: 0
 *     audit_sha256: 2d7c9a78e141d30fa8d1cc7cddf843969dbaa86fe6e66712070186cc7ba10a5d
 *   exploration_model: null
 *   discoverability:
 *     tags:
 *     - git
 *     - repository
 *     - handoff
 * parameters:
 * - name: repo_root
 *   param_type: string
 *   required: true
 *   default: null
 *   description: Absolute path to a local Git repository
 *   example: /path/to/repository
 *   valid_values: null
 * steps:
 *   working_tree:
 *     type: process.exec
 *     argv:
 *     - git
 *     - -C
 *     - $repo_root
 *     - status
 *     - --short
 *   recent_commits:
 *     type: process.exec
 *     argv:
 *     - git
 *     - -C
 *     - $repo_root
 *     - log
 *     - --oneline
 *     - '-5'
 *   tracked_markers:
 *     type: process.exec
 *     argv:
 *     - bash
 *     - -c
 *     - git -C "$1" grep -nE "(TODO|FIXME|XXX)" || test $? -eq 1
 *     - bash
 *     - $repo_root
 * ---
 */

const presentationSdk = await import("__ROTE_PRESENTATION_SDK__").catch((cause) => {
  throw new Error(
    "This is a rote steps presentation program. Run it with `rote play run <name>`.",
    { cause },
  );
});
const { FlowOutput, isProcessExecBody, loadPresentationContext, stepName } = presentationSdk;

const out = new FlowOutput();
const ctx = await loadPresentationContext();
out.setRunStatus(ctx.run.status);

const workingTree = ctx.requireCompleted(stepName("working_tree"));
const recentCommits = ctx.requireCompleted(stepName("recent_commits"));
const trackedMarkers = ctx.requireCompleted(stepName("tracked_markers"));

function stdout(observation: typeof workingTree, name: string): string {
  if (!isProcessExecBody(observation.body)) {
    throw new Error(`${name} did not record a process result`);
  }
  if (observation.body.status.exit.kind !== "code" || observation.body.status.exit.code !== 0) {
    throw new Error(`${name} failed: ${observation.body.stderr?.text ?? "no diagnostic"}`);
  }
  return observation.body.stdout?.text ?? "";
}

const changes = stdout(workingTree, "working_tree").trim().split("\n").filter(Boolean);
const commits = stdout(recentCommits, "recent_commits").trim().split("\n").filter(Boolean);
const markers = stdout(trackedMarkers, "tracked_markers").trim().split("\n").filter(Boolean).slice(0, 20);
const repository = ctx.params.repo_root;

out.human([
  `# Repository pulse: ${repository}`,
  `Working tree: ${changes.length} changed file(s)`,
  `Recent commits:\n${commits.length ? commits.map((line) => `- ${line}`).join("\n") : "- No commits"}`,
  `Tracked markers: ${markers.length}\n${markers.length ? markers.map((line) => `- ${line}`).join("\n") : "- None found"}`,
].join("\n\n"));
out.summary(`${String(repository)}: ${changes.length} changed file(s), ${commits.length} recent commit(s), ${markers.length} tracked marker(s)`);
out.result({ repository, changed_files: changes, recent_commits: commits, markers });
