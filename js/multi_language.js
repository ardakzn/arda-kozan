
//define language reload anchors
var lang_selectors = document.querySelectorAll("[language]");

var language={
  en:{
    navbar:["About","Portfolio","Contact"],
    about:["Game Developer . ","I have 3 years of experience for video game development. I took my first step into this job with Unity Engine. And now, I maintain all my work with Unreal Engine."],
    portfolio:["Portfolio","In this section, there are information about the projects I have been involved in and about my responsibilities. Click on an image to see more details."],
    p_modal1:["This project is actually my graduation project at the university, and it is also a finalist  video game Project that developed with Unreal Engine 4.",
    "Project Description",
    "This is a multiplayer virtual reality game that allows players socialize them each other. In order to provide socialization in the game, a virtual environment has been created using VR technology. There are some game elements in this virtual environment where players can interact with each other.",
    "Choose your character","There are multiple characters in the game. Select the character you want to enter the virtual environment.",
    "Hangout with your friends!","Spend time with your friends with in-game mini-games (block tower, shooting range, ball game) or using video content on TVs.",
    "My Responsibilities",
    "Building an Animation blueprint that integrated with VR for the characters by Using Unreal Engine 4.","Developing Networking replications for Multiplayer system.","Designing some UI elements."],
    p_modal2:["Blood On The Cotton (BOTC) is a demo video game project developed with Unreal Engine 4 upon request from Fiverr.",
    "Project Description",
    "BOTC is a story-based, third-person, stealth game. The game deals with the subject of slavery in the Pre-War Period of American history. The player (the main character) takes on the role of a slave who is forced to work in Pendleton Plantation, trying to reach the North, seeking his freedom.",
    "Go gather information, try to stay hidden and find a way to escape plantation!",
    "Do the missions that need to be done by following the instructions in the game. Explore the farm and gather information by talking to the characters in the surrounding area. Try to escape from the farm by using the privacy feature according to the information you collect.",
    "My Responsibilities",
    "Developing game mechanics such as locomotion, stealth and combat system.","Creating some cinematic sequences by using Unreal Engine 4.","Constructing an landscape and arranging some elements in a environment."],
    p_modal3:["Rise of Darkness is a video game project developed with the Unreal Engine 4 at the Game Jam event (HKU Game Jam 2021) held at our school.","Game Jam Theme: “Losing”",
    "Project Description",
    "Rise of Darkness is a third-person horror game. The game takes place in a house that is said to have a large amount of money and is said to be cursed. The main character of the game enters this cursed house in search of money after hearing these rumors at night time.",
    "If the player doesn't meet certain conditions while inside the house, they start to lose their sanity and see different things.",
    "Keep your light on and keep your sanity","Renew your torch by going to the candlesticks and keep searching the house until you find the money.",
    "My Responsibilities",
    "Developing several Gameplay Mechanic in basics.","Integrating several external assets to the Project.","Arranging some gameplay elements in a Level."],
    p_modal4:["L.P.F is a video game project developed with Unity Engine at the Global Game Jam event (GGJ 2021) held at our school.","Game Jam Theme: “Lost & Found”",
    "Project Description",
    "L.P.F is a third-person parkour game. The main character of the game is responsible for finding these items, being an employee of the lost and found office. The player has various materials (metal detector, drone) that he can use to find items.",
    "Try to find clue","Depending on your attitude towards people who lost their item at the beginning of the game, you can get more hints. Use it in your favor.",
    "Use your materials and find that item!","You don't need to go around the whole map to find the item, you have useful materials, use them. There may be places you cannot reach, you can use your drone for this.",
    "My Responsibilities",
    "Taking part in Level design in Unity Engine.","Developing some Gameplay Mechanics such as drone movement."],
    p_modal5:["This project is a video game project developed with Unreal Engine 4, which won the Teknofest 2020 event.",
    "Project Description",
    "This project is a multiplayer virtual reality game. In this project, we designed a 3D virtual park environment for children undergoing cancer treatment. In this environment, there are materials (slides, swings, see-saws) where children can have fun with their friends.",
    "My Responsibilities",
    "Managing some Animation states and Level designing.","Fixing some bugs in Networking for multiplayer system.","Developing several Gameplay Mechanic in basics."],
    p_modal6:["Hay Aksi is a video game project developed with Unity Engine at the Global Game Jam event (GGJ 2020) held at our school. At the same time, this project is my first experience.","Game Jam Theme: “Repair”",
    "Project Description",
    "Hay Aksi is a third-person puzzle game. The game deals with the subject of a character who suddenly breaks down and tries to repair his vehicle while he is traveling by car on the road.",
    "In order to do this repair job, he must first collect the repair items and then solve a small puzzle.",
    "My Responsibilities",
    "I was responsible with Level Design in Unity Engine.","Helping to several fixing bugs."],
    contact:["Contact","You can reach me anywhere but I’ll usually respond faster if you contact me through LinkedIn or WhatsApp.","Email Address: ","Telephone Number: "]
  },
  tr: {
    navbar:["Hakkımda","Portfolyo","İletişim"],
    about:["Oyun Geliştirici . ","Video oyun geliştirme konusunda 3 yıllık tecrübem var. Bu işe ilk adımımı Unity Engine ile attım. Ve artık tüm işlerimi Unreal Engine ile devam ettiriyorum."],
    portfolio:["Portfolyo","Bu bölümde benim bulunduğum projeler hakkında ve benim sorumluluklarım hakkında bilgiler bulunmaktadır.<span class='text-primary'> Daha fazla bilgi için resme tıklayın.</span>"],
    p_modal1:["Bu proje aslında benim üniversitede bitirme projem olmakla birlikte ve aynı zamanda da Teknofest 2022 yarışmasında finalist olan, Unreal Engine 4 ile geliştirilen bir video oyunu projesidir.",
    "Proje Açıklaması",
    "Bu proje, oyuncuların birbirleriyle sosyalleşmesini sağlayan çok oyunculu bir sanal gerçeklik oyunudur. Oyunda sosyalleşmeyi sağlamak için, VR teknolojisi kullanılarak bir sanal ortam oluşturulmuştur. Bu sanal ortamda oyuncuların birbirleriyle etkileşime geçebilecekleri bazı ögeler bulunmaktadır.",
    "Karakterini seç","Oyunda birden fazla karakter bulunmakta. Sanal ortama girmek istediğin karakteri seç.",
    "Arkadaşlarınla takıl","Oyun içinde bulunan mini oyunlarla (kule dizme, poligon, top oyunu) veya televizyonlardaki video içeriklerini kullanarak arkadaşlarınızla vakit geçirin.",
    "Benim Sorumluluklarım",
    "Unreal Engine 4 kullanarak, karakterler için VR destekli bir Animasyon geçişlerini oluşturmak.","Çok oyunculu sistem için Ağ Replikasyonlarını geliştirmek.","Bazı kullanıcı Arayüzü elementlerini dizayn etmek."],
    p_modal2:["Blood On The Cotton (BOTC), Fiverr üzerinden gelen istek üzerine Unreal Engine 4 ile geliştirilen bir demo video oyun projesidir.",
    "Proje Açıklaması",
    "BOTC hikaye tabanlı, üçüncü şahıs, gizlilik oyunudur.  Oyun Amerikan tarihinin Savaş Öncesi Dönemi’nde yaşanan kölelik konusunu ele alır. Oyuncu (Ana karakter), Pendleton çiftliğinde zorla çalıştırılan, Kuzey'e ulaşmaya çalışan, özgürlüğünü arayan bir köle rolünü üstlenir.",
    "Bilgi topla, gizli kalmaya çalış ve çiftlikten kaçmanın bir yolunu bul!",
    "Oyundaki talimatları izleyerek yapılması gereken görevleri yap. Çiftliği araştır ve çevrede bulunan karakterlerle konuşarak bilgi topla. Topladığın bilgiler doğrultusunda gizlilik özelliğini de kullanarak çiftlikten kaçmaya çalış.",
    "Projedeki Sorumluluklarım",
    "Hareket, gizlilik ve dövüş sistemi gibi oyun mekaniklerini geliştirmek.","Unreal Engine 4 oyun motorunu kullanarak bazı sinematik sahneler oluşturmak.","Bir harita oluşturmak ve çevredeki bazı öğeleri düzenlemek."],
    p_modal3:["Rise of Darkness, okulumuzda düzenlenen Game Jam etkinliğinde (HKU Game Jam 2021), Unreal Engine 4 ile geliştirilen bir video oyunu projesidir.","Game Jam Teması: “Kaybetmek”",
    "Proje Açıklaması",
    "Rise of Darkness üçüncü şahıs bir korku oyunudur. Oyun yüklü bir miktarda para olduğu söylenilen ve lanetli olduğu söylenilen bir evde geçiyor. Oyunun ana karakteri, gece saatinde bu söylentileri duyduktan sonra parayı aramak için bu lanetli eve giriyor.",
    "Oyuncu evin içindeyken bazı koşulları yerine getirmezse akıl sağlığını kaybetmeye başlar ve farklı şeyler görmeye başlar.",
    "Işığını yenile ve akıl sağlığını koru","Meşaleni, şamdanlara giderek tazele ve parayı bulana kadar evi araştırmaya devam et.",
    "Projedeki Sorumluluklarım",
    "Oyun için bazı temel Oynanış Mekaniklerini geliştirmek.","Bazı harici kaynakları projeye Entegre etmek.","Haritadaki bazı Oyun içi ögeleri düzenlemek."],
    p_modal4:["L.P.F, okulumuzda düzenlenen Global Game Jam etkinliğinde (GGJ 2021), Unity Engine ile geliştirilen bir video oyunu projesidir.","Game Jam Teması: “Kaybolmak ve Bulunmak”",
    "Proje Açıklaması",
    "L.P.F üçüncü şahıs bir parkur oyunudur. Oyunun ana karakteri, kayıp eşya bürosunun bir çalışanı olmak üzere bu eşyaları bulmakla sorumludur. Oyuncu, eşyaları bulmak için kullanabileceği çeşitli materyallere (metal dedektörü, dron) sahiptir.",
    "İpucu bulmaya çalış","Oyunun başında eşyasını kaybeden insanlara karşı tavrına bağlı olarak daha fazla ipucu alabilirsin. Bunu lehine kullan.",
    "Materyallerini kullan ve o eşyayı bul!","Eşyayı bulmak için tüm haritayı gezmene gerek yok, işe yarar materyallerin var bunları kullan. Erişemediğin yerler olabilir bunun için dronunu kullanabilirsin.",
    "Projedeki Sorumluluklarım",
    "Unity Engine'de harita tasarımında yer almak.","Drone hareketi gibi bazı oyun mekaniklerinin geliştirilmesi."],
    p_modal5:["Bu proje, Teknofest 2020 yarışmasında birinci olan, Unreal Engine 4 ile geliştirilen bir video oyunu projesidir.",
    "Proje Açıklaması",
    "Bu proje, çok oyunculu bir sanal gerçeklik oyunudur. Bu projede kanser tedavisi gören çocuklar için 3B bir sanal park ortamı tasarladık. Bu ortamda çocuklar arkadaşları ile eğlenceli vakit geçirebilecekleri materyaller (kaykay, salıncak, tahterevalli) bulunmaktadır.",
    "Projedeki Sorumluluklarım",
    "Animasyon durumlarını yönetmek ve oyun içindeki Haritayı tasarlamak.","Çok oyunculu sistemdeki bazı hataları düzeltmek.","Oyun içindeki bazı Oyun Mekaniklerini geliştirmek."],
    p_modal6:["Hay Aksi, okulumuzda düzenlenen Global Game Jam etkinliğinde (GGJ 2020), Unity Engine ile geliştirilen bir video oyunu projesidir. Aynı zamanda bu proje benim ilk tecrübemdir.","Game Jam Teması: “Tamir etmek”",
    "Proje Açıklaması",
    "Hay Aksi, üçüncü şahıs bir bulmaca oyunudur. Oyun, yolda arabayla seyahat ederken bir anda aracı arızalan ve aracını tamir etmeye çalışan bir karakterin konusunu ele alır.",
    "Bu tamir işini yapması için de önce tamir eşyalarını toplaması ve sonra da ufak bir bulmacayı çözmesi gerekir.",
    "Projedeki Sorumluluklarım",
    "Unity Engine üzerinden Harita tasarlamak.","Bazı hataların düzeltilmesine yardımcı olmak."],
    contact:["İletişim","Bana her yerden ulaşabilirsiniz, ancak benimle LinkedIn veya WhatsApp aracılığıyla iletişime geçerseniz genellikle daha hızlı yanıt verebilirim.","E-posta Adresi: ","Telefon Numarası: "]
  }
};


//Define language via window hash
if(window.location.hash){

  if(window.location.hash==="#TR"){//if Turkish selected
    localStorage.setItem('language','turkish');
    
  }
  else{ // default lang
    localStorage.setItem('language','english');
  }
 
}

if(localStorage.getItem('language')==='turkish'){
  /*Navbar Section*/
  var elements = document.getElementById('navbarSupportedContent').getElementsByTagName('a');//Geting navbar elements that just has "a" tags to translate.
  for (let i = 0; i < elements.length; i++) {
    elements[i].textContent=language.tr.navbar[i]; //Change text content in navbar elements
  }
  
  /*About Section*/
  document.getElementById('job').childNodes[0].textContent=language.tr.about[0]//change job text in the about section
  document.getElementById('about').getElementsByTagName('p')[0].textContent=language.tr.about[1]//change header of contact section,

  /*Portfolio Section*/
  document.getElementById('portfolio').getElementsByTagName('h2')[0].textContent=language.tr.portfolio[0]//change header of portfolio section
  document.getElementById('portfolio').getElementsByTagName('p')[0].innerHTML=language.tr.portfolio[1]
  /*Portfolio Modal 1*/
  elements=document.getElementById('portfolioModal1').getElementsByTagName('p')
  for (let i = 0; i < elements.length; i++) {
    elements[i].textContent=language.tr.p_modal1[i]; //Change text content in navbar elements
  }
  /*Portfolio Modal 2*/
  elements=document.getElementById('portfolioModal2').getElementsByTagName('p')
  for (let i = 0; i < elements.length; i++) {
    elements[i].textContent=language.tr.p_modal2[i]; //Change text content in navbar elements
  }
  /*Portfolio Modal 3*/
  elements=document.getElementById('portfolioModal3').getElementsByTagName('p')
  for (let i = 0; i < elements.length; i++) {
    elements[i].textContent=language.tr.p_modal3[i]; //Change text content in navbar elements
  }
  /*Portfolio Modal 4*/
  elements=document.getElementById('portfolioModal4').getElementsByTagName('p')
  for (let i = 0; i < elements.length; i++) {
    elements[i].textContent=language.tr.p_modal4[i]; //Change text content in navbar elements
  }
  /*Portfolio Modal 5*/
  elements=document.getElementById('portfolioModal5').getElementsByTagName('p')
  for (let i = 0; i < elements.length; i++) {
    elements[i].textContent=language.tr.p_modal5[i]; //Change text content in navbar elements
  }
  /*Portfolio Modal 6*/
  elements=document.getElementById('portfolioModal6').getElementsByTagName('p')
  for (let i = 0; i < elements.length; i++) {
    elements[i].textContent=language.tr.p_modal6[i]; //Change text content in navbar elements
  }
  /*Portfolio Modal Close Buttons*/
  elements=document.body.getElementsByTagName('button')
  for (let i = 0; i < elements.length; i++) {
    if(elements[i].classList.contains("modal-close"))
    elements[i].innerHTML="<i class='fas fa-xmark fa-fw'></i>Pencereyi Kapat"; //Change text content in navbar elements
  }

  /*Contact Section*/
  document.getElementById('contact').getElementsByTagName('h2')[0].textContent=language.tr.contact[0]//change header of contact section
  elements = document.getElementById('contact').getElementsByTagName('p')
  for (let i = 0; i < elements.length; i++) {
    elements[i].childNodes[0].textContent=language.tr.contact[i+1]; //Change text content in navbar elements
  }

  //Change active language navbar element's class
  for (let i = 0; i < lang_selectors.length; i++) {
    if(lang_selectors[i].getAttribute("language")==="turkish"){
      lang_selectors[i].classList.add("active-lang");
    } 
    else if(lang_selectors[i].classList.contains("active-lang")){
      lang_selectors[i].classList.remove("active-lang")
    }
  }
}

//define language reload onclick iteration
for (let i=0; i < lang_selectors.length; i++){
  lang_selectors[i].onclick = function(){
    setTimeout(location.reload.bind(location), 0);//Reload page with 0 delay
  };
}