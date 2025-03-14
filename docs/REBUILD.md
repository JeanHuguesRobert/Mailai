# REBUILD.md

## Objective
This document outlines the steps and considerations for rebuilding the MailAI application after recent changes were lost.

## Summary of Key Changes
1. **Plugin Architecture**: 
   - Modified the `PluginManager` class to load only the `unavailable.js` plugin initially.
   - Introduced a mechanism to determine which plugin to invoke based on persona configuration.

2. **AI Provider Configuration**:
   - Transitioned to using a global configuration object instead of relying solely on environment variables.
   - Discussed the structure of `config.personas` entries.

3. **Plugin Independence**:
   - Ensured that plugins operate independently, allowing only one plugin to process a message at a time.

4. **Error Handling**:
   - Enhanced error handling in the plugin loading process to ensure execution stops on critical errors.

5. **Dry Run Mode**:
   - Implemented a `dry_run` mode to prevent side effects during testing.
   - Added checks in functions that perform actions leading to side effects (sending emails, modifying databases, etc.).

6. **Configuration Loading**:
   - Updated the `getAIConfig` function to handle persona configurations correctly.

7. **Plugin Logic Updates**:
   - Adjusted the `unavailable.js` plugin to respect the `dry_run` mode and log intended actions.

## Additional Key Changes
8. **Transition to ES Modules**:
   - Switched from CommonJS to ES modules to utilize modern JavaScript features.
   - Updated import/export syntax throughout the codebase.
   - Handled the absence of `__dirname` and `__filename` in ES modules by using `import.meta.url`.
9. **Enhanced Logging**:
   - Implemented logging for plugin loading and execution to aid in debugging.
   - Added logging for `dry_run` mode to track intended actions.

## Comprehensive Rebuilding Plan

1. **Review and Understand Requirements**: Go through the conversation summary in REBUILD.md to identify key features and functionalities that need to be implemented.

2. **Implement Email Functionality**:
   - **Enhance Authentication**: Review the authentication middleware in email.js to ensure it is robust.
   - **IMAP Connection**: Review and optimize the createImapConnection method for better error handling and logging.
   - **Email Sending**: Validate and enhance the sendEmail method to handle different scenarios, including:
     - Sending emails with attachments.
     - Handling different email formats (HTML, plain text).
     - Implementing retries for failed sends.

3. **Add New Features**: Identify additional features discussed, such as:
   - Improved logging mechanisms.
   - Integration with AI responses for email processing.

4. **Testing**: Write unit tests for the email functionalities to ensure they work as expected. Implement integration tests to verify that the email service interacts correctly with other components.

5. **Documentation**: Update the documentation in REBUILD.md and other relevant files to reflect changes made and the rationale behind them. Ensure that the code is well-commented.

6. **Backup and Version Control**: Regularly commit changes to the local repository. Push changes to the remote repository to maintain a backup.

7. **Review and Refactor**: Review the code for potential refactoring opportunities to improve readability and maintainability.

8. **Final Testing and Deployment**: Conduct final tests to ensure all functionalities work as expected. Prepare for deployment if applicable.

9. **Monitor and Iterate**: Monitor the application for issues or feedback after deployment. Iterate on features based on user feedback.

10. **Address User Concerns**: Implement a strategy for better version control and backup practices to prevent future data loss. Consider implementing a feature that logs all Git commands executed in the project for transparency.

11. **Establish a Communication Protocol**: Set up a protocol for notifying users of changes made to the repository or significant updates to the application.

12. **Configuration Standards**: Ensure that configuration standards for MailAI are documented and followed, especially regarding unavailable AI settings.

13. **Complete the sendEmail Method**: Ensure it handles different scenarios, such as sending emails with attachments, handling different email formats, and implementing retries for failed sends.

14. **Enhance Logging**: Review the logging mechanisms to ensure all significant actions and errors are logged appropriately.

15. **Implement Email Processing Logic**: Ensure the processEmail method effectively handles incoming emails and integrates with AI functionalities.

16. **Validation and Error Handling**: Improve validation for email addresses and content to prevent sending errors. Implement robust error handling to manage common issues.

17. **User Feedback Mechanism**: Implement a mechanism for users to provide feedback on email functionalities.

18. **Regular Code Reviews**: Establish a process for regular code reviews to ensure code quality and adherence to best practices.

## Tasks to Rebuild Email Functionality

1. **Review the `EmailService` Class**:
   - Ensure the class is structured to handle email functionalities including authentication, connection management, and email handling.

2. **Enhance Email Sending Functionality**:
   - Implement validation for required fields in the `sendEmail` method.
   - Ensure logging of actions and errors during the email sending process.

3. **Improve Logging Mechanisms**:
   - Add detailed logging for all significant actions and errors to facilitate debugging and monitoring.

4. **Integrate AI Responses**:
   - Consider how to integrate AI responses for processing incoming emails effectively.

5. **Update Documentation**:
   - Ensure that the documentation reflects the changes made to the `EmailService` class and its methods.

## Steps to Rebuild
1. **Identify Key Functions**:
   - List all functions that were modified or created during the session.

2. **Reimplement `dry_run` Checks**:
   - For each identified function, reintroduce the `dry_run` checks to ensure side effects are prevented.

3. **Restore Plugin Logic**:
   - Revisit plugin files and ensure they respect the `dry_run` mode.

4. **Recheck Configuration Logic**:
   - Ensure that the configuration loading logic correctly handles environment variables.

5. **Testing**:
   - After reimplementing the changes, run the application in `dry_run` mode to confirm no actual changes occur.

## Side Effects to Prevent in `dry_run` Mode
1. **Sending Emails**: Prevent actual email sending during `dry_run`.
2. **Database Modifications**: Prevent any database write operations.
3. **File System Operations**: Prevent writing to or deleting files.
4. **Network Requests**: Prevent making actual API calls.
5. **External API Calls**: Prevent calls to external APIs that may incur costs or have unintended consequences.

## Additional Considerations
- Review the transition from CommonJS to ES modules and ensure compatibility across the codebase.
- Confirm that all dependencies and plugins are compatible with ES module syntax.
- Refactor existing code to replace CommonJS patterns with ES module patterns.
- Verify that logging is properly configured and functional.

## Configuration Standards for MailAI

### Unavailable AI
- Set ai: MAILAI_{PERSONA}_ai=unavailable
- Optional fields:
  - unavailable_message: Custom unavailable message
  - prompt: Custom prompt to include in response
- Full example:
  MAILAI_MyPersona_ai=unavailable
  # Optional custom message
  MAILAI_MyPersona_unavailable_message=Service temporarily down
  # Optional prompt to include
  MAILAI_MyPersona_prompt=AI agent, Institut Mariani

## Detailed Tasks for Each Functionality

1. **Email Functionality**:
   - **Review the `EmailService` Class**:
     - Ensure the class handles authentication, connection management, and email handling correctly.
   - **Enhance Email Sending Functionality**:
     - Implement validation for required fields in the `sendEmail` method.
     - Log actions and errors during the email sending process.
   - **Improve Logging Mechanisms**:
     - Add detailed logging for significant actions and errors to facilitate debugging and monitoring.

2. **Configuration Standards**:
   - **Implement Configuration Settings**:
     - Ensure that configuration settings for MailAI are correctly applied throughout the application.
     - Validate the configuration for AI availability and custom messages.

3. **Additional Features**:
   - **Document Other Functionalities**:
     - Identify and document any additional features that were discussed but not yet implemented.
   - **Testing and Validation**:
     - Create test cases for all functionalities to ensure they work as intended.

## Next Steps
- Begin implementing these tasks in the codebase, starting with the `EmailService` class and configuration settings.
- Ensure to document any changes made during the implementation process for future reference.

## Conversation Summary

This document contains a summary of the conversation regarding the user's experience with Git, including issues faced, potential causes of lost changes, and insights on branch management.

## Key Points

1. **Branch Management**: The user has two branches, `main` and `origin/main`, and discussed the implications of switching branches without committing changes.
2. **Loss of Changes**: The user expressed concern about losing hours of work, which may have been caused by uncommitted changes or branch switching.
3. **Command History**: The user inquired about the history of Git commands executed, emphasizing the need for better tracking of actions taken in the repository.
4. **IDE Behavior**: The user mentioned exiting and restarting the IDE, leading to concerns about unsaved changes and the state of the repository.
5. **Recommendations**: Suggestions were provided to regularly commit changes, use branches effectively, and enable auto-save features in the IDE.

## Additional Context

The conversation also covered the creation of the `main` branch and the `origin/main` branch, explaining their roles in version control. The user is encouraged to maintain backups and utilize Git's features to prevent future losses.

## Summary of Findings

1. **Email Functionality**:
   - The `EmailService` class is central, with methods for sending emails and managing IMAP connections.
   - Emphasis on validation, logging, and error handling.

2. **Configuration Standards**:
   - Configuration settings for MailAI were discussed, which may affect the overall structure and implementation.

3. **Additional Features**:
   - Other functionalities were mentioned that need to be documented and potentially reconstructed.

## Next Steps

1. **Document Findings in REBUILD.md**: Compile all findings and tasks into the REBUILD.md document to ensure a comprehensive reconstruction plan.
2. **Outline Specific Tasks**: Create a detailed list of tasks that need to be completed for each functionality discussed.

---
