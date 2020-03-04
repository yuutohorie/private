document.addEventListener('DOMContentLoaded', async () => {
  await flarebase.initializeApp(config.firebase);

  if (!flarebase.auth.isSignIn()) {
    var res = await flarebase.auth.signInAnonymously();
    // firestore のほうにもユーザーをセット
    var user = await app.store.users.get();
    user.doc.ref.set(res.user);
  }

  await spalate.start();
});
