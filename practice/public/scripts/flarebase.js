
;((global) => {

  var flarebase = {
    async initializeApp(config) {
      firebase.initializeApp(config);
      this.store.init();
      // ここで currentUser 存在チェック待ち
      await this.auth.init();
    },

    auth: {
      // サインインのチェック
      init() {
        return new Promise(resolve => {
          var completed = firebase.auth().onIdTokenChanged(async (user) => {
            // 監視を停止
            completed();

            if (user) {
              resolve(user);
            }
            else {
              resolve(null);
            }
          });
        });
      },

      // 
      async signInAnonymously() {
        try {
          var res = await firebase.auth().signInAnonymously();
          var data = this._normalizeResponse(res);
          return data;
        }
        catch(e) {
          e.error_message = this._codeToErrorMessage(e.code);

          throw e;
        }
      },

      // メアド/パスワードでアカウント作成
      async createUserWithEmailAndPassword(email, password) {
        try {
          var res = await firebase.auth().createUserWithEmailAndPassword(email, password);;
          var data = this._normalizeResponse(res);
          return data;
        }
        catch(e) {
          e.error_message = this._codeToErrorMessage(e.code);

          throw e;
        }
      },
      async signInWithEmailAndPassword(email, password) {
        try {
          var res = await firebase.auth().signInWithEmailAndPassword(email, password);;
          var data = this._normalizeResponse(res);
          return data;
        }
        catch(e) {
          e.error_message = this._codeToErrorMessage(e.code);

          throw e;
        }
      },

      async signInWithPopup(providerId) {
        try {
          var provider = this.idToProvider(providerId);
          var res = await firebase.auth().signInWithPopup(provider);
          var data = this._normalizeResponse(res);

          return data;
        }
        catch (e) {
          e.error_message = this._codeToErrorMessage(e.code);

          throw e;
        }
      },

      async linkWithPopup(providerId) {
        try {
          var provider = this.idToProvider(providerId);
          var res = await firebase.auth().currentUser.linkWithPopup(provider);
          var data = this._normalizeResponse(res);

          return data;
        }
        catch (e) {
          e.error_message = this._codeToErrorMessage(e.code);

          throw e;
        }
      },

      async signInWithCredential(credential) {
        try {
          var res = await firebase.auth().signInWithCredential(credential);
          return res;
        }
        catch (e) {
          e.error_message = this._codeToErrorMessage(e.code);

          throw e;
        }

      },

      idToProvider(providerId) {
        var provider = {
          'google.com': firebase.auth.GoogleAuthProvider,
          'twitter.com': firebase.auth.TwitterAuthProvider,
          'facebook.com': firebase.auth.FacebookAuthProvider,
        }[providerId];

        return new provider;
      },

      async refreshToken() {
        var user = firebase.auth().currentUser;
        if (user) {
          // token の結果を取得
          var idTokenResult = await user.getIdTokenResult();
          // token 有効期限を超えていた場合は token をリフレッシュ
          var isRefresh = moment(idTokenResult.expirationTime).isSameOrBefore();
  
          // var isRefresh = true;
          var token = await firebase.auth().currentUser.getIdToken(isRefresh);

          return token;
        }
      },

      isSignIn() {
        return !!firebase.auth().currentUser;
      },

      signOut() {
        firebase.auth().signOut();
        return this;
      },

      _normalizeResponse(res) {
        // 共通情報
        var user = {
          uid: res.user.uid,
          screen_name: res.user.uid,
          display_name: res.user.displayName,
          profile: '',
          email: res.user.email,
          verified_email: res.user.emailVerified,
          image: res.user.photoURL,
          // 匿名かどうか
          isAnonymous: res.user.isAnonymous,
        };

        var userInfo = res.additionalUserInfo;

        // sns 差分を吸収
        if (userInfo.providerId === 'google.com') {
          // TODO: 
        }
        else if (userInfo.providerId === 'twitter.com') {
          user.screen_name = userInfo.profile.screen_name;
          user.profile = userInfo.profile.description;
          user.image = userInfo.profile.profile_image_url_https.replace('_normal', '');
        }
        else if (userInfo.providerId === 'facebook.com') {
          // TODO: facebook api で大きな画像を取ってきて差し替える
        }
        else if (userInfo.providerId === 'password') {
          // TODO: 
        }

        return {
          user: user,
          providerId: userInfo.providerId,
          // 新しいユーザーかどうか
          isNewUser: userInfo.isNewUser,
        };
      },

      _codeToErrorMessage(code) {
        return {
          // 共通
          'auth/argument-error': '不正な引数によるエラーです',
          // sign up
          'auth/email-already-in-use': 'このメールアドレスはすでに使用されています',
          'auth/invalid-email': 'メールアドレスの形式が間違っています',
          'uth/operation-not-allowed': 'メールアドレス/パスワードによるアカウント登録が有効化されていません',
          'auth/weak-password': 'パスワードのセキュリティが弱すぎます',
          // sign in
          'auth/user-not-found': 'ユーザーが存在しませんでした',
          // sns
          'auth/popup-closed-by-user': 'ログイン処理が中断されました',
          'auth/user-cancelled': 'ログインを拒否しました',
          'auth/provider-already-linked': 'すでにこのアカウントに紐付けられています',
          'auth/credential-already-in-use': 'すでに他のアカウントで使用されています',
        }[code];
      },
    },

    store: {
      _cache: {},

      init() {
        this.db = firebase.firestore();
        return this;
      },

      async get(collection, id, opts = {}) {
        var cache = this._cache[collection] || {};
    
        if (opts.cache !== false && cache[id]) {
          return cache[id];
        }
        else {
          var doc = await flarebase.store.db.collection(collection).doc(id).get();
          var item = await this.normalize(doc, opts);
    
          return item;
        }
      },
  
      async getCollection(ref) {
        var ss = await ref.get();
  
        var promises = ss.docs.map(async (doc) => {
          var item = await this.normalize(doc);
          return item;
        });
  
        return Promise.all(promises);
      },
  
      watch(ref, callback) {
        var isNew = false;
        return new Promise((resolve) => {
          var observer = ref.onSnapshot(async (ss) => {
            for (let change of ss.docChanges()) {
              var item = await this.normalize(change.doc);
              callback && callback({change, item, isNew});
            }
    
            isNew = true;
    
            resolve(observer);
          });
        });
      },
  
      // データ構造整理してついでにキャッシュする
      async normalize(doc, opts = {}) {
        var item = {
          id: doc.id,
          doc: doc,
          data: doc.data(),
        };
    
        // キャッシュ
        var collection = doc.ref.parent.path;
    
        if (!this._cache[collection]) {
          this._cache[collection] = {};
        }
        var cache = this._cache[collection];
        if (cache[doc.id]) {
          cache[doc.id].doc = item.doc;
          cache[doc.id].data = item.data;
        }
        else {
          cache[doc.id] = item;
        }
    
        // リレーションの展開
        if (doc.exists && opts.relation !== false) {
          var keys = Object.keys(item.data);
          for (let key of keys) {
            var value = item.data[key];
            if (value instanceof firebase.firestore.DocumentReference) {
              item.data[ key.replace(/_ref$/, '') ] = await this.get(value.parent.path, value.id);
            }
          }
        }
    
        return item;
      },
    },
  };

  firebase.firestore.DocumentReference.prototype.getWithRelation = function(opts) {
    return flarebase.store.get(this.parent.path, this.id, opts);
  };

  firebase.firestore.Query.prototype.getWithRelation = function() {
    return flarebase.store.getCollection(this);
  };

  firebase.firestore.Query.prototype.watch = function(callback) {
    return flarebase.store.watch(this, callback);
  };

  global.flarebase = flarebase;

})(this);
