#!/bin/bash

# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Mailai - AI Email Assistant"

# Rename default branch to main
git branch -M main

# Add remote (replace USERNAME with your GitHub username)
echo "Enter your GitHub username:"
read username
git remote add origin "https://github.com/$username/mailai.git"

# Push to GitHub
git push -u origin main

echo "Repository initialized and pushed to GitHub!"
echo "Next steps:"
echo "1. Go to https://github.com/$username/mailai/settings"
echo "2. Enable GitHub Pages (Settings > Pages)"
echo "3. Configure branch (main) and folder (/web)"
echo "4. Set up repository secrets for CI/CD"
