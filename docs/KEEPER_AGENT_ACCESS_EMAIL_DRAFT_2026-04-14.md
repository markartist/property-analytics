# Keeper / Secrets Manager For Agent Access

**Subject:** Re: Keeper / Secrets Manager for Agent Access

Hi Matt,

Yes, Keeper can likely help with this.

The simplest way to think about it is:

- Keeper is the secure place where passwords and sensitive information are stored.
- Keeper Secrets Manager is the part designed for systems, apps, and automation to use those secrets without a person having to manually copy them.

Answers to your questions:

**Can our agent (systems user account) access the passwords?**
Yes, it can, as long as it is set up with the right access. We would not normally have it use a person's account. Instead, we'd give the system its own approved access to the specific passwords or secrets it needs.

**Do we need to use Secrets Manager instead?**
For an automated agent, probably yes. That is the cleaner and safer way to do it. It is meant for non-human access, whereas the regular Keeper experience is more for people logging in and viewing passwords themselves.

**What does it look like for the user?**
For a normal user, it still looks like Keeper: passwords are stored there and shared securely.
For the agent, it would just be given secure access behind the scenes, so it can use the password when needed without someone manually handling it each time.

**Can we use it for ourselves?**
Yes. People can use Keeper directly for their own password access, and systems or agents can use Secrets Manager for automated access. So both can be true at the same time.

**Short version:**

- People use Keeper
- Systems and automation use Secrets Manager
- Both are part of the same overall secure approach

If helpful, Phil and I can give a very short walkthrough of what this would look like in practice and what setup would be needed for your project.

Thanks,
Mark
