# GitHub Actions for Upbound - up project

This action is used to build Upbound projects and optionally push them to the
Upbound Marketplace. It requires up to be installed (you can use
[upbound/action-up](https://github.com/upbound/action-up) action)

## Usage

To install the latest version of `up` and use it in GitHub Actions workflows,
[create an Upbound API token](https://docs.upbound.io/all-spaces/spaces/console/#create-a-personal-access-token),
[add it as a secret to your repository](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions#creating-encrypted-secrets-for-a-repository),
and add the following step to your workflow:

```yaml
- name: Checkout Repository
  uses: actions/checkout@v4

- name: Install and login with up
  uses: upbound/action-up@v1
  with:
    api-token: ${{ secrets.UP_API_TOKEN }}
    organization: my-org

- name: Build Upbound project
  uses: upbound/action-up-project@v1
```

```yaml
- name: Checkout Repository
  uses: actions/checkout@v4

- name: Install and login with up
  uses: upbound/action-up@v1
  with:
    api-token: ${{ secrets.UP_API_TOKEN }}
    organization: my-org

- name: Build and Push Upbound project
  uses: upbound/action-up-project@v1
  with:
    push-project: true
```

## Contributing

> [!NOTE]
>
> You'll need to have a reasonably modern version of
> [Node.js](https://nodejs.org) handy. If you are using a version manager like
> [`nodenv`](https://github.com/nodenv/nodenv) or
> [`nvm`](https://github.com/nvm-sh/nvm), you can run `nodenv install` in the
> root of your repository to install the version specified in
> [`package.json`](./package.json). Otherwise, 20.x or later should work!

1. :hammer_and_wrench: Install the dependencies

   ```bash
   npm install
   ```

1. :building_construction: Package the JavaScript for distribution

   ```bash
   npm run bundle
   ```

1. :white_check_mark: Run the tests

   ```bash
   $ npm test
   PASS  __tests__/main.test.js
    action
      ✓ installs the up cli successfully (2 ms)
      ✓ installs the up cli successfully without a v in front of the version (1 ms)

   PASS  __tests__/index.test.js
    index
      ✓ calls run when imported (1 ms)
   ...
   ```
