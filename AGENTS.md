<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Brainrot data in src/data/brainrots.ts is generated from Steal a Brainrot wiki categories; `rarityScore` drives `price`, so regenerate rather than hand-edit prices.
- Player state is saved via src/lib/player.functions.ts keyed by Telegram id, verified with Telegram initData HMAC (TELEGRAM_BOT_TOKEN); localStorage is only a fast local backup.
