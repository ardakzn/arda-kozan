
//define language reload anchors
var lang_selectors = document.querySelectorAll("[language]");

var language={
  "en":{
    "ml-navbar":[
      "About",
      "Portfolio",
      "Contact",
    ],
    "ml-about":[
      "Game Developer",
      "I have 4 years of experience for video game development. I took my first step into this job with Unity engine. And now, I maintain all my work with Unreal Engine.",
    ],
    "ml-portfolio":[
      "Portfolio",
      "In this section, there are information about the projects I have been involved in and about my responsibilities.",
      "Click on an image to see more details.",
    ],
    "ml-contact":[
      "Contact",
      "You can reach me anywhere but I’ll usually respond faster if you contact me through LinkedIn.",
      "Email Address:",
    ],
    "ml-pmodal1":[
      "This project is a engine plugin that I developed for the Unreal Engine and offered for sale on the Unreal Engine Marketplace.",
      //Project Description
      "This engine plugin, allows the recoil system which is generally used in shooter games to be added to the Unreal projects in a more flexible and easy way. The purpose of this plugin is to provide a flexible recoil system with various features that can be customized by those who want to include this system in their Unreal project. Thanks to these features, the flexibility and variety of the project can be increased by producing different settings.",
      "Customize your recoil",
      "This recoil system includes many settings that you can customize such as recoil speed, spread rate, recoil pattern etc. Create and edit your own recoil.",
      "Create own recoil pattern",
      "There is an editor tool where you can adjust all the recoil settings and also draw recoil pattern by placing dots. Create and edit your own throwback style.",
      "For more information about the plugin and to play its demo:",
      //My Responsibilities
      "Developing the entire Recoil system using Blueprint and some of it using C++.",
      "Working with Editor Scripting tools available in Unreal Engine.",
      "Working with Network Replications to make the plugin Multiplayer Ready.",
      "Preparing the necessary elements such as documentation, video, demo for publishing the plugin.",
    ],
    "ml-pmodal2":[
      "This project is actually my graduation project at the university, and it is also a finalist  video game Project that developed with Unreal Engine 4.",
      //Project Description
      "This is a multiplayer virtual reality game that allows players socialize them each other. In order to provide socialization in the game, a virtual environment has been created using VR technology. There are some game elements in this virtual environment where players can interact with each other.",
      "Choose your character",
      "There are multiple characters in the game. Select the character you want to enter the virtual environment.",
      "Hangout with your friends!",
      "Spend time with your friends with in-game mini-games (block tower, shooting range, ball game) or using video content on TVs.",
      //My Responsibilities
      "Building an Animation blueprint that integrated with VR for the characters by Using Unreal Engine 4.",
      "Developing Networking replications for Multiplayer system.",
      "Designing some UI elements.",
    ],
    "ml-pmodal3":[
      "Blood On The Cotton (BOTC) is a demo video game project developed with Unreal Engine 4 upon request from Fiverr.",
      //Project Description
      "BOTC is a story-based, third-person, stealth game. The game deals with the subject of slavery in the Pre-War Period of American history. The player (the main character) takes on the role of a slave who is forced to work in Pendleton Plantation, trying to reach the North, seeking his freedom.",
      "Go gather information, try to stay hidden and find a way to escape plantation!",
      "Do the missions that need to be done by following the instructions in the game. Explore the farm and gather information by talking to the characters in the surrounding area. Try to escape from the farm by using the privacy feature according to the information you collect.",
      //My Responsibilities
      "Developing game mechanics such as locomotion, stealth and combat system.",
      "Creating some cinematic sequences by using Unreal Engine 4.",
      "Constructing an landscape and arranging some elements in a environment.",
    ],
    "ml-pmodal4":[
      "Rise of Darkness is a video game project developed with the Unreal Engine 4 at the Game Jam event (HKU Game Jam 2021) held at our school.",
      "Game Jam Theme: “Losing”",
      //Project Description
      "Rise of Darkness is a third-person horror game. The game takes place in a house that is said to have a large amount of money and is said to be cursed. The main character of the game enters this cursed house in search of money after hearing these rumors at night time.",
      "If the player doesn't meet certain conditions while inside the house, they start to lose their sanity and see different things.",
      "Keep your light on and keep your sanity",
      "Renew your torch by going to the candlesticks and keep searching the house until you find the money.",
      //My Responsibilities
      "Developing several Gameplay Mechanic in basics.",
      "Integrating several external assets to the Project.",
      "Arranging some gameplay elements in a Level.",
    ],
    "ml-pmodal5":[
      "L.P.F is a video game project developed with Unity engine at the Global Game Jam event (GGJ 2021) held at our school.",
      "Game Jam Theme: “Lost & Found”",
      //Project Description
      "L.P.F is a third-person parkour game. The main character of the game is responsible for finding these items, being an employee of the lost and found office. The player has various materials (metal detector, drone) that he can use to find items.",
      "Try to find clue",
      "Depending on your attitude towards people who lost their item at the beginning of the game, you can get more hints. Use it in your favor.",
      "Use your materials and find that item!",
      "You don't need to go around the whole map to find the item, you have useful materials, use them. There may be places you cannot reach, you can use your drone for this.",
      //My Responsibilities
      "Taking part in Level design in Unity engine.",
      "Developing some Gameplay Mechanics such as drone movement.",
    ],
    "ml-pmodal6":[
      "This project is a video game project developed with Unity engine, which won the Teknofest 2020 event.",
      //Project Description
      "This project is a multiplayer virtual reality game. In this project, we designed a 3D virtual park environment for children undergoing cancer treatment. In this environment, there are materials (slides, swings, see-saws) where children can have fun with their friends.",
      //My Responsibilities
      "Managing some Animation states and Level designing.",
      "Fixing some bugs in Networking for multiplayer system.",
      "Developing several Gameplay Mechanic in basics.",
    ],
    "ml-pmodal7":[
      "Hay Aksi is a video game project developed with Unity engine at the Global Game Jam event (GGJ 2020) held at our school. At the same time, this project is my first experience.",
      //Project Description
      "Game Jam Theme: “Repair”",
      "Hay Aksi is a third-person puzzle game. The game deals with the subject of a character who suddenly breaks down and tries to repair his vehicle while he is traveling by car on the road.",
      "In order to do this repair job, he must first collect the repair items and then solve a small puzzle.",
      //My Responsibilities
      "I was responsible with Level Design in Unity engine.",
      "Helping to several fixing bugs.",
    ],
    "ml-recursive":[
      "Project Description",
      "My Responsibilities",
      "Close Window"
    ]
  },
  "tr":{
    "ml-navbar":[ 
      "Hakkımda",
      "Portfolyo",
      "İletişim",
    ],
    "ml-about":[
      "Oyun Geliştirici",
      "Video oyun geliştirme konusunda 4 yıllık tecrübem var. Bu işe ilk adımımı Unity engine ile attım. Ve artık tüm işlerimi Unreal Engine ile devam ettiriyorum.",
    ],
    "ml-portfolio":[
      "Portfolyo",
      "Bu bölümde benim bulunduğum projeler hakkında ve benim sorumluluklarım hakkında bilgiler bulunmaktadır.",
      "Daha fazla bilgi için resme tıklayın.",
    ],
    "ml-contact":[
      "İletişim",
      "Bana her yerden ulaşabilirsiniz, ancak benimle LinkedIn aracılığıyla iletişime geçerseniz genellikle daha hızlı yanıt verebilirim.",
      "E-posta Adresi:",
      "Telefon Numarası:",
    ],
    "ml-pmodal1":[
      "Bu proje Unreal Engine motoru için geliştirdiğim ve Unreal Engine Marketplace üzerinden satışa sunduğum bir eklentidir.",
      //Proje Açıklaması
      "Bu motor eklentisi, genelde shooter oyunlarda kullanılan geri tepme sistemini daha esnek ve kolay bir şekilde unreal projesine eklemenize imkan sağlar. Bu eklentinin amacı, unreal projesine bu sistemi dahil etmek isteyenlere, onların düzenleyebileceği çeşitli özelliklere sahip ve esnek bir yapıya sahip geri tepme sistemi sağlamaktır. Bu özellikler sayesinde birbirinden farklı ayarlar üreterek projenin esnekliği ve çeşitliliği arttırılabilir.",
      "Recoil Ayarlarını Özelleştir",
      "Bu geri tepme sistemi, içerisinde özelleştirebileceğiniz tepme hızı, dağılma oranı, dağılma şekli gibi bir çok ayar barındırır. Kendi geri tepme stilini oluştur ve düzenle.",
      "Kendi geri tepme stilini oluştur",
      "Bütün geri tepme ayarlarını düzenleyebileceğiniz ve ayrıca silahın hangi şekilde sekeceğini nokta koyarak çizim yapabileceğiniz bir editor aracı bulunmaktadır. Kendi geri tepme stilini oluştur ve düzenle.",
      "Eklenti hakkında daha fazla bilgi ve demosunu oynamak için:",
      //Projedeki Sorumluluklarım
      "Bütün Geri tepme sistemini blueprint kullanarak, bir kısmını da C++ kullanarak geliştirmek.",
      "Unreal Engine'de bulunan Editor Scripting araçlari ile çalışmak.",
      "Eklentiyi Çok Oyunculu Kullanıma Hazır hale getirmek için Ağ Replikasyonları ile çalışmak.",
      "Plugini yayınlamak için dokümantasyon, video, demo gibi gerekli unsurları hazırlamak."
    ],
    "ml-pmodal2":[
      "Bu proje aslında benim üniversitede bitirme projem olmakla birlikte ve aynı zamanda da Teknofest 2022 yarışmasında finalist olan, Unreal Engine 4 ile geliştirilen bir video oyunu projesidir.",
      //Proje Açıklaması
      "Bu proje, oyuncuların birbirleriyle sosyalleşmesini sağlayan çok oyunculu bir sanal gerçeklik oyunudur. Oyunda sosyalleşmeyi sağlamak için, VR teknolojisi kullanılarak bir sanal ortam oluşturulmuştur. Bu sanal ortamda oyuncuların birbirleriyle etkileşime geçebilecekleri bazı ögeler bulunmaktadır.",
      "Karakterini seç",
      "Oyunda birden fazla karakter bulunmakta. Sanal ortama girmek istediğin karakteri seç.",
      "Arkadaşlarınla takıl",
      "Oyun içinde bulunan mini oyunlarla (kule dizme, poligon, top oyunu) veya televizyonlardaki video içeriklerini kullanarak arkadaşlarınızla vakit geçirin.",
      //Projedeki Sorumluluklarım
      "Unreal Engine 4 kullanarak, karakterler için VR destekli bir Animasyon geçişlerini oluşturmak.",
      "Çok oyunculu sistem için Ağ Replikasyonlarını geliştirmek.",
      "Bazı kullanıcı Arayüzü elementlerini dizayn etmek.",
    ],
    "ml-pmodal3":[
      "Blood On The Cotton (BOTC), Fiverr üzerinden gelen istek üzerine Unreal Engine 4 ile geliştirilen bir demo video oyun projesidir.",
      //Proje Açıklaması
      "BOTC hikaye tabanlı, üçüncü şahıs, gizlilik oyunudur.  Oyun Amerikan tarihinin Savaş Öncesi Dönemi’nde yaşanan kölelik konusunu ele alır. Oyuncu (Ana karakter), Pendleton çiftliğinde zorla çalıştırılan, Kuzey'e ulaşmaya çalışan, özgürlüğünü arayan bir köle rolünü üstlenir.",
      "Bilgi topla, gizli kalmaya çalış ve çiftlikten kaçmanın bir yolunu bul!",
      "Oyundaki talimatları izleyerek yapılması gereken görevleri yap. Çiftliği araştır ve çevrede bulunan karakterlerle konuşarak bilgi topla. Topladığın bilgiler doğrultusunda gizlilik özelliğini de kullanarak çiftlikten kaçmaya çalış.",
      //Projedeki Sorumluluklarım
      "Hareket, gizlilik ve dövüş sistemi gibi oyun mekaniklerini geliştirmek.",
      "Unreal Engine 4 oyun motorunu kullanarak bazı sinematik sahneler oluşturmak.",
      "Bir harita oluşturmak ve çevredeki bazı öğeleri düzenlemek.",
    ],
    "ml-pmodal4":[
      "Rise of Darkness, okulumuzda düzenlenen Game Jam etkinliğinde (HKU Game Jam 2021), Unreal Engine 4 ile geliştirilen bir video oyunu projesidir.",
      "Game Jam Teması: “Kaybetmek”",
      //Proje Açıklaması
      "Rise of Darkness üçüncü şahıs bir korku oyunudur. Oyun yüklü bir miktarda para olduğu söylenilen ve lanetli olduğu söylenilen bir evde geçiyor. Oyunun ana karakteri, gece saatinde bu söylentileri duyduktan sonra parayı aramak için bu lanetli eve giriyor.",
      "Oyuncu evin içindeyken bazı koşulları yerine getirmezse akıl sağlığını kaybetmeye başlar ve farklı şeyler görmeye başlar.",
      "Işığını yenile ve akıl sağlığını koru",
      "Meşaleni, şamdanlara giderek tazele ve parayı bulana kadar evi araştırmaya devam et.",
      //Projedeki Sorumluluklarım
      "Oyun içi bazı temel Oynanış Mekaniklerini geliştirmek.",
      "Bazı harici kaynakları projeye Entegre etmek.",
      "Haritadaki bazı Oyun içi ögeleri düzenlemek.",
    ],
    "ml-pmodal5":[
      "L.P.F, okulumuzda düzenlenen Global Game Jam etkinliğinde (GGJ 2021), Unity engine ile geliştirilen bir video oyunu projesidir.",
      "Game Jam Teması: “Kaybolmak ve Bulunmak”",
      //Proje Açıklaması
      "L.P.F üçüncü şahıs bir parkur oyunudur. Oyunun ana karakteri, kayıp eşya bürosunun bir çalışanı olmak üzere bu eşyaları bulmakla sorumludur. Oyuncu, eşyaları bulmak için kullanabileceği çeşitli materyallere (metal dedektörü, dron) sahiptir.",
      "İpucu bulmaya çalış",
      "Oyunun başında eşyasını kaybeden insanlara karşı tavrına bağlı olarak daha fazla ipucu alabilirsin. Bunu lehine kullan.",
      "Materyallerini kullan ve o eşyayı bul!",
      "Eşyayı bulmak için tüm haritayı gezmene gerek yok, işe yarar materyallerin var bunları kullan. Erişemediğin yerler olabilir bunun için dronunu kullanabilirsin.",
      //Projedeki Sorumluluklarım
      "Unity engine'de harita tasarımında yer almak.",
      "Drone hareketi gibi bazı oyun mekaniklerinin geliştirilmesi.",
    ],
    "ml-pmodal6":[
      "Bu proje, Teknofest 2020 yarışmasında birinci olan, Unity engine ile geliştirilen bir video oyunu projesidir.",
      //Proje Açıklaması
      "Bu proje, çok oyunculu bir sanal gerçeklik oyunudur. Bu projede kanser tedavisi gören çocuklar için 3B bir sanal park ortamı tasarladık. Bu ortamda çocuklar arkadaşları ile eğlenceli vakit geçirebilecekleri materyaller (kaykay, salıncak, tahterevalli) bulunmaktadır.",
      //Projedeki Sorumluluklarım
      "Animasyon durumlarını yönetmek ve oyun içindeki Haritayı tasarlamak.",
      "Çok oyunculu sistemdeki bazı hataları düzeltmek.",
      "Oyun içindeki bazı Oyun Mekaniklerini geliştirmek.",
    ],
    "ml-pmodal7":[
      "Hay Aksi, okulumuzda düzenlenen Global Game Jam etkinliğinde (GGJ 2020), Unity engine ile geliştirilen bir video oyunu projesidir. Aynı zamanda bu proje benim ilk tecrübemdir.",
      "Game Jam Teması: “Tamir etmek”",
      //Proje Açıklaması
      "Hay Aksi, üçüncü şahıs bir bulmaca oyunudur. Oyun, yolda arabayla seyahat ederken bir anda aracı arızalan ve aracını tamir etmeye çalışan bir karakterin konusunu ele alır.",
      "Bu tamir işini yapması için de önce tamir eşyalarını toplaması ve sonra da ufak bir bulmacayı çözmesi gerekir.",
      //Projedeki Sorumluluklarım
      "Unity engine üzerinden Harita tasarlamak.",
      "Bazı hataların düzeltilmesine yardımcı olmak.",
    ],
    "ml-recursive":[
      "Proje Açıklaması",
      "Projedeki Sorumluluklarım",
      "Pencereyi Kapat"
    ]
  }
};

//Define language via window hash
if(window.location.hash){

  if(window.location.hash==="#TR"){//if Turkish selected
    localStorage.setItem('language','tr');
  }
  else{ // default lang
    localStorage.setItem('language','en');
  }
}

var lang = localStorage.getItem('language')//**If there is an item in local save**

translate(language[lang],"ml-navbar");
translate(language[lang],"ml-about");
translate(language[lang],"ml-portfolio");
translate(language[lang],"ml-contact");
translate(language[lang],"ml-recursive");
translate(language[lang],"ml-pmodal1");
translate(language[lang],"ml-pmodal2");
translate(language[lang],"ml-pmodal3");
translate(language[lang],"ml-pmodal4");
translate(language[lang],"ml-pmodal5");
translate(language[lang],"ml-pmodal6");
translate(language[lang],"ml-pmodal7");


//Change active language navbar element's class
for (let i = 0; i < lang_selectors.length; i++) {
  if(lang_selectors[i].getAttribute("language")===lang){
    lang_selectors[i].classList.add("active-lang");
  } 
  else if(lang_selectors[i].classList.contains("active-lang")){
    lang_selectors[i].classList.remove("active-lang")
  }
}


//define language reload onclick iteration
for (let i=0; i < lang_selectors.length; i++){
  lang_selectors[i].onclick = function(){
    setTimeout(location.reload.bind(location), 0);//Reload page with 0 delay
  };
}

function translate(lang_text,category_name){

  var elements = document.querySelectorAll("t."+ category_name);//get navbar elements to translate  
  if(lang_text[category_name].length<elements.length){//if recursive
    for (let i=0,j=0; i < elements.length; i++,j++){
      j=(j>lang_text[category_name].length-1) ? 0 : j;
      elements[i].textContent=lang_text[category_name][j];//transtlate text content for navbar elements
    };
  }
  else{
    for (let i=0; i < elements.length; i++){
      elements[i].textContent=lang_text[category_name][i];//transtlate text content for navbar elements
    };
  }
}

  
