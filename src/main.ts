import * as core from '@actions/core';
import * as github from '@actions/github';

interface TeamMember {
  "login": string,
  "id": number,
  "node_id": string,
  "avatar_url": string,
  "gravatar_id": string,
  "url": string,
  "html_url": string,
  "followers_url": string,
  "following_url": string,
  "gists_url": string,
  "starred_url": string,
  "subscriptions_url": string,
  "organizations_url": string,
  "repos_url": string,
  "events_url": string,
  "received_events_url": string,
  "type": string,
  "site_admin": boolean;
}

export async function run() {
  try {
    const
      repoToken = core.getInput('repo-token', { required: true }),
      organisation = core.getInput('organisation', { required: true }),
      issue: { owner: string; repo: string; number: number } = github.context.issue
      core.setSecret(repoToken);

    if (issue == null || issue.number == null) {
      console.log('No pull request context, skipping')
      return
    }

    //See https://octokit.github.io/rest.js/
    const client = new github.GitHub(repoToken)

    const includeDraft : Boolean =  Boolean(core.getInput('include-draft') || false)
    const pull = await client.pulls.get(
      {
        owner: issue.owner,
        repo: issue.repo,
        pull_number: issue.number
      }
    )

    if(pull.data.draft && !includeDraft){
      console.log('Skipped: DRAFT Pull Request, not assigning PR.')
      return
    }

    const teams = core.getInput('teams').split(',').map(a => Number(a.trim()))

    if(teams.length == 0){
      core.setFailed("Please specify 'teams'")
      return
    }

    console.log("Adding teams: " + teams)
    for(let teamSlug of teams) {
      const teamMembers: TeamMember[] = (await client.request('GET /orgs/{org}/teams/{team_slug}/members', {
        org: organisation,
        team_slug: teamSlug
      })).data

      const reviewers = teamMembers.map(member => member.login);

      const teamResponse = await client.pulls.createReviewRequest(
        {
          owner: issue.owner,
          repo: issue.repo,
          pull_number: issue.number,
          reviewers
        }
      )

      console.log("Request Status:" + teamResponse.status + ", Teams: " + teamResponse?.data?.requested_teams?.map(t => t.slug).join(','))
    }

  } catch (error) {
    core.setFailed(error.message)
    throw error
  }
}

run()
