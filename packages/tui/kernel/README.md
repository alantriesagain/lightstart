# @light/kernel

What a plugin-made app is built on, light-free (a key reaches it as light's `KeyEvent` type only): `Kernel` (`kernel.ts`) starts the plugins in the order their `requires` allow and keeps the switched-off ones and the problems; `Plugin` (`plugin.ts`) is what a plugin subclasses; `Commands` (`commands.ts`) the slash commands with their completions; `Actions` (`actions.ts`) the named actions by scope with their default keys, bound through a `Binder`; `Keys` (`keys.ts`) the key specs and the layered keymaps (the user's layer first, then the plugins' newest first); `Hook` (`hook.ts`) an owner-keyed list of listeners that get nothing and read what changed; `Settings` (`settings.ts`) a plugin's section of the config and its kept state behind a `StateFile`; `Keyed<T>` (`registry.ts`) the registry the commands, actions, key layers and an app's segments share.

Tests: `test/kernel.test.ts`, under node and natively (`light-native test kernel`).
