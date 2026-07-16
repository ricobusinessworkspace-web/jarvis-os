# Deployment Rule
Always commit and push your changes to GitHub (origin main) when you finish a feature or bugfix, instead of just telling the user to test it on localhost. The user relies on Vercel's auto-deployment. 

Command to use:
```bash
git add .
git commit -m "feat/fix: describe your changes"
git push origin main
```
