package dev.lightstart.mobile

/**
 * The app another one started for a photo, a clip or a file. It is the same
 * shell in the caller's task: the launcher's singleTask MainActivity cannot
 * answer a request for a result. It opens the capture or pick page and
 * finishes with what the page returns.
 */
class ResultActivity : MainActivity() {
    override val forResult: Boolean get() = true
}
