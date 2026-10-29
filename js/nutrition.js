// Calories and protein, estimated offline from a built-in table (typical values per 100 g,
// based on common food composition tables). No network, no API. Names in Italian, German and English.
//
// Each food: [keywords separated by "|", kcal per 100 g, protein g per 100 g, extra]
// extra: piece = grams per piece ("2 uova"), dens = g per ml (for spoons, cups, ml),
//        can / pack / slice = grams for "1 scatola", "1 confezione", "1 fetta".

import { parseIngredient } from './parse.js';

const HERB = { piece: 1, dens: 0.3 };
const SPICE = { piece: 1, dens: 0.5 };
const FOODS = [
  // pasta, grains, bread
  ['pasta|spaghetti|spaghettini|penne|fusilli|rigatoni|linguine|bucatini|maccheroni|farfalle|orecchiette|paccheri|mezze maniche|tagliolini|trofie|ditalini|vermicelli|nudeln|noodles|makkaroni|pasta secca|tagliatelle|fettuccine|pappardelle|lasagne|lasagna', 358, 12.5, { pack: 500 }],
  ['pasta fresca|pasta all uovo|fresh pasta|frische nudeln|eiernudeln|egg noodles', 288, 11],
  ['tortellini|ravioli|cappelletti|agnolotti|tortelloni|maultaschen', 300, 12, { pack: 250 }],
  ['gnocchi|gnocchetti|schupfnudeln', 133, 3.5, { pack: 500 }],
  ['spatzle|knopfle|spaetzle', 200, 7],
  ['riso|rice|reis|arborio|carnaroli|vialone|basmati|jasmine rice|risottoreis|milchreis', 358, 7, { dens: 0.85, pack: 1000 }],
  ['farina|flour|mehl|weizenmehl|farina 00|farina 0|manitoba|dinkelmehl', 350, 10.5, { dens: 0.55, pack: 1000 }],
  ['farina integrale|whole wheat flour|wholemeal flour|vollkornmehl', 340, 13, { dens: 0.55 }],
  ['farina di mais|polenta|cornmeal|maisgriess|maismehl|bramata', 362, 8, { dens: 0.65 }],
  ['semola|semolino|semolina|griess|hartweizengriess', 360, 12.7, { dens: 0.65 }],
  ['farina di mandorle|almond flour|ground almonds|gemahlene mandeln|mandelmehl', 600, 21, { dens: 0.45 }],
  ['farina di riso|rice flour|reismehl', 366, 6, { dens: 0.6 }],
  ['farina di ceci|chickpea flour|kichererbsenmehl', 387, 22, { dens: 0.5 }],
  ['pangrattato|pan grattato|breadcrumbs|bread crumbs|semmelbrosel|paniermehl|panko', 395, 13, { dens: 0.45 }],
  ['pane|bread|brot|brotchen|semmel|panino|panini|baguette|ciabatta|toast|pancarre|weissbrot|bun|buns|roll|rolls', 265, 9, { piece: 50, slice: 30 }],
  ['pane integrale|vollkornbrot|wholemeal bread|whole wheat bread|schwarzbrot|roggenbrot|rye bread', 250, 9, { piece: 50, slice: 40 }],
  ['pane raffermo|stale bread|altbackenes brot|knodelbrot', 280, 9.5, { slice: 30 }],
  ['fette biscottate|zwieback|rusks', 410, 11, { piece: 9 }],
  ['crackers|cracker|grissini', 430, 10, { piece: 6 }],
  ['biscotti|cookies|kekse|biscuits|frollini|butterkekse|digestive', 480, 6.5, { piece: 10 }],
  ['savoiardi|ladyfingers|lady fingers|loffelbiskuit|biscotti savoiardi', 390, 8, { piece: 8 }],
  ['amaretti', 450, 7, { piece: 5 }],
  ['fiocchi d avena|avena|oats|rolled oats|haferflocken|porridge oats|oatmeal', 380, 13, { dens: 0.4 }],
  ['cornflakes|corn flakes', 360, 7, { dens: 0.12 }],
  ['couscous|cous cous', 376, 12.8, { dens: 0.75 }],
  ['bulgur', 342, 12, { dens: 0.75 }],
  ['quinoa', 368, 14, { dens: 0.75 }],
  ['orzo|orzo perlato|barley|pearl barley|graupen|perlgraupen', 352, 10, { dens: 0.8 }],
  ['farro|spelt|dinkel|grunkern', 340, 14, { dens: 0.8 }],
  ['pasta frolla|shortcrust|shortcrust pastry|murbeteig|pasta brisee|brisee|pate brisee', 460, 6, { pack: 230 }],
  ['pasta sfoglia|puff pastry|blatterteig|sfoglia', 550, 7, { pack: 230 }],
  ['pasta per pizza|impasto per pizza|pizza dough|pizzateig', 250, 7, { pack: 400 }],
  ['pasta fillo|filo pastry|phyllo|yufka|strudelteig', 300, 7, { pack: 250 }],
  ['tortilla|tortillas|wraps|wrap|piadina|piadine', 300, 8, { piece: 60 }],
  ['lievito di birra|lievito fresco|yeast|hefe|fresh yeast|frischhefe|germ', 105, 8.4, { pack: 25, piece: 25 }],
  ['lievito secco|dry yeast|trockenhefe|instant yeast', 325, 40, { pack: 7 }],
  ['lievito|lievito per dolci|baking powder|backpulver|lievito vanigliato|bicarbonato|baking soda|natron', 53, 0, { pack: 16, dens: 0.9 }],
  // dairy and eggs
  ['latte|milk|milch|vollmilch|whole milk|latte intero', 64, 3.3, { dens: 1.03, pack: 1000 }],
  ['latte scremato|latte parzialmente scremato|skim milk|skimmed milk|semi skimmed milk|fettarme milch|magermilch|low fat milk', 42, 3.4, { dens: 1.03 }],
  ['panna|panna fresca|panna liquida|panna da montare|cream|heavy cream|whipping cream|double cream|sahne|schlagsahne|schlagobers|obers|rahm', 340, 2.1, { dens: 1, pack: 200 }],
  ['panna da cucina|cooking cream|kochsahne|single cream|light cream|cremefine', 195, 2.6, { dens: 1, pack: 200 }],
  ['panna acida|sour cream|saure sahne|sauerrahm|schmand', 200, 2.4, { dens: 1, pack: 200 }],
  ['creme fraiche|crème fraîche', 290, 2.4, { dens: 1, pack: 200 }],
  ['burro|butter|beurre|burro chiarificato|ghee|butterschmalz', 717, 0.9, { dens: 0.91, pack: 250, piece: 10 }],
  ['yogurt|yoghurt|joghurt|jogurt|yogurt bianco|naturjoghurt|plain yogurt', 61, 3.5, { pack: 125, piece: 125 }],
  ['yogurt greco|greek yogurt|griechischer joghurt|griechisches joghurt', 97, 9, { pack: 170, piece: 170 }],
  ['skyr', 63, 11, { pack: 150 }],
  ['quark|topfen|magerquark|speisequark', 90, 12, { pack: 250 }],
  ['mascarpone', 440, 4.6, { pack: 250 }],
  ['ricotta', 160, 10, { pack: 250 }],
  ['mozzarella|fior di latte', 250, 18, { piece: 125, pack: 125 }],
  ['mozzarella di bufala|buffalo mozzarella|bufala|burrata', 290, 16.5, { piece: 125, pack: 125 }],
  ['parmigiano|parmigiano reggiano|parmesan|parmesano|grana|grana padano|parmesankase', 392, 33, { dens: 0.4, slice: 20 }],
  ['pecorino|pecorino romano|romano', 390, 28, { dens: 0.4 }],
  ['gorgonzola', 350, 19],
  ['fontina', 389, 25, { slice: 20 }],
  ['emmentaler|emmental|swiss cheese|gruyere|greyerzer|bergkase|alpkase|appenzeller|raclette|raclettekase', 390, 28, { slice: 20 }],
  ['gouda|edamer|edam|butterkase|tilsiter|cheddar|asiago|montasio|provolone|scamorza|caciocavallo', 360, 26, { slice: 20 }],
  ['taleggio|brie|camembert|stracchino|crescenza|robiola', 300, 19],
  ['feta|schafskase|hirtenkase', 264, 14, { pack: 200 }],
  ['philadelphia|formaggio spalmabile|cream cheese|frischkase|doppelrahmfrischkase', 342, 6, { pack: 175 }],
  ['formaggio grattugiato|grated cheese|geriebener kase|reibekase', 390, 30, { dens: 0.4 }],
  ['formaggio|cheese|kase', 370, 25, { slice: 20 }],
  ['uovo|uova|egg|eggs|ei|eier|uova intere', 143, 12.6, { piece: 50 }],
  ['tuorlo|tuorli|egg yolk|egg yolks|yolk|yolks|eigelb|eidotter|dotter', 322, 16, { piece: 17 }],
  ['albume|albumi|egg white|egg whites|eiweiss|eiklar|chiara|chiare', 52, 11, { piece: 33 }],
  // meat
  ['carne macinata|macinato|macinato di manzo|macinato misto|ground beef|minced beef|minced meat|ground meat|mince|hackfleisch|rinderhack|gemischtes hack|faschiertes|hack', 250, 17.5],
  ['manzo|beef|rind|rindfleisch|polpa di manzo|bistecca|steak|filetto di manzo|roastbeef|brasato|spezzatino|rinderbraten|tafelspitz|rindergulasch|gulasch|goulash|stew meat|scamone|girello', 180, 21],
  ['vitello|veal|kalb|kalbfleisch|fesa di vitello|scaloppine|kalbsfilet|schnitzel|ossobuco|ossibuchi', 115, 21, { piece: 150 }],
  ['maiale|pork|schwein|schweinefleisch|lonza|lombo|arista|braciola|braciole|filetto di maiale|pork loin|pork chop|schweinefilet|kotelett|nackensteak|schweinebraten|costine|ribs|spareribs|rippchen', 200, 19, { piece: 180 }],
  ['pollo|chicken|hahnchen|huhn|hendl|poulet|gallina|whole chicken|pollo intero|suppenhuhn', 215, 18.6, { piece: 900 }],
  ['petto di pollo|chicken breast|hahnchenbrust|hahnchenbrustfilet|huhnerbrust|petti di pollo|chicken breasts|hahnchenfilet|chicken fillet|fesa di tacchino|petto di tacchino|turkey breast|putenbrust|truthahnbrust|putenfilet', 115, 23, { piece: 180, slice: 60 }],
  ['cosce di pollo|coscia di pollo|sovracosce|chicken thighs|chicken thigh|chicken legs|drumsticks|hahnchenschenkel|hahnchenkeulen|keulen', 180, 17.5, { piece: 130 }],
  ['tacchino|turkey|pute|truthahn', 140, 21, { piece: 180 }],
  ['agnello|lamb|lamm|lammfleisch|abbacchio|lamb chops|lammkoteletts', 280, 16.5, { piece: 100 }],
  ['coniglio|rabbit|kaninchen|hase', 136, 20, { piece: 1200 }],
  ['anatra|duck|ente|petto d anatra|duck breast|entenbrust', 200, 19, { piece: 300 }],
  ['fegato|liver|leber|fegatini|chicken livers', 135, 20],
  ['guanciale', 655, 8, { slice: 10 }],
  ['pancetta|bacon|bauchspeck|fruhstucksspeck|lardo|lardons|pancetta tesa|pancetta affumicata|dadini di pancetta|speckwurfel', 455, 14, { slice: 12, pack: 150 }],
  ['speck', 350, 22, { slice: 12, pack: 100 }],
  ['prosciutto crudo|prosciutto di parma|parma ham|serrano|rohschinken|parmaschinken|culatello|coppa', 270, 26, { slice: 12, pack: 100 }],
  ['prosciutto|prosciutto cotto|ham|cooked ham|kochschinken|schinken', 145, 19, { slice: 20, pack: 100 }],
  ['salsiccia|salsicce|sausage|sausages|bratwurst|luganega|salamella|chipolata|wurst', 300, 15, { piece: 100 }],
  ['wurstel|wurstchen|wiener|wiener wurstchen|frankfurter|hot dog|hotdog|frankfurters|viennese', 270, 12, { piece: 50 }],
  ['salame|salami|salamino|soppressata|nduja|chorizo|salsiccia piccante', 400, 22, { slice: 8 }],
  ['mortadella|fleischwurst|lyoner', 311, 15, { slice: 15 }],
  ['bresaola', 150, 32, { slice: 8 }],
  ['carne|meat|fleisch', 200, 20],
  // fish
  ['tonno|tuna|thunfisch|tonno sott olio|tonno in scatola|canned tuna|tuna in oil', 190, 27, { can: 80, pack: 80 }],
  ['tonno al naturale|tuna in water|thunfisch naturell|tonno fresco|fresh tuna|tuna steak|thunfischsteak', 125, 26, { can: 80, piece: 150 }],
  ['salmone|salmon|lachs|lachsfilet|filetto di salmone|salmon fillet', 208, 20, { piece: 150 }],
  ['salmone affumicato|smoked salmon|raucherlachs|graved lachs', 117, 18, { slice: 15, pack: 100 }],
  ['merluzzo|cod|kabeljau|dorsch|nasello|hake|seehecht|baccala|stoccafisso|stockfisch|haddock|schellfisch|platessa|plaice|scholle|sogliola|sole|seezunge|pollock|seelachs|alaska seelachs', 85, 19, { piece: 150 }],
  ['orata|branzino|spigola|sea bass|sea bream|dorade|wolfsbarsch|trota|trout|forelle|saibling|persico|perch|barsch|zander|pesce|fish|fisch|fischfilet|fish fillet|filetti di pesce', 110, 19.5, { piece: 300 }],
  ['pesce spada|swordfish|schwertfisch', 144, 20, { piece: 180 }],
  ['sgombro|mackerel|makrele|aringa|herring|hering|matjes|sardine|sardines|sardinen|sarde', 205, 19, { piece: 100, can: 90 }],
  ['acciughe|alici|anchovies|anchovy|sardellen|sardellenfilets|filetti di acciuga|anchovy fillets', 210, 29, { piece: 4, can: 50 }],
  ['gamberi|gamberetti|gamberoni|mazzancolle|scampi|shrimp|shrimps|prawns|prawn|garnelen|krabben|crevetten|langostinos|code di gambero', 85, 20, { piece: 15 }],
  ['cozze|mussels|miesmuscheln|muscheln', 86, 12],
  ['vongole|clams|venusmuscheln|lupini', 74, 13],
  ['calamari|calamaro|seppie|seppia|squid|cuttlefish|tintenfisch|tintenfische|totani|calamaretti|moscardini', 92, 16, { piece: 100 }],
  ['polpo|polipo|octopus|oktopus|krake', 82, 15, { piece: 1000 }],
  ['granchio|crab|krebs|astice|aragosta|lobster|hummer', 90, 19],
  ['surimi|bastoncini di granchio|crab sticks', 95, 7.6, { piece: 15 }],
  // vegetables
  ['pomodoro|pomodori|tomato|tomatoes|tomate|tomaten|pomodori ramati|pomodori maturi|san marzano|cuore di bue|fleischtomate|fleischtomaten|strauchtomaten', 18, 0.9, { piece: 120 }],
  ['pomodorini|pomodori ciliegini|ciliegini|datterini|pomodori datterini|pachino|cherry tomatoes|cherry tomato|grape tomatoes|kirschtomaten|cocktailtomaten|cherrytomaten|datteltomaten', 18, 0.9, { piece: 15 }],
  ['pelati|pomodori pelati|passata|passata di pomodoro|polpa di pomodoro|pomodori a pezzi|canned tomatoes|chopped tomatoes|crushed tomatoes|tomato puree|tomato sauce|tomatensauce|dosentomaten|geschalte tomaten|passierte tomaten|stuckige tomaten|tomatenpassata|salsa di pomodoro|sugo di pomodoro|polpa', 24, 1.2, { can: 400, pack: 500, dens: 1.03 }],
  ['concentrato di pomodoro|doppio concentrato|tomato paste|tomatenmark|triplo concentrato', 82, 4.3, { dens: 1.1, can: 140 }],
  ['pomodori secchi|sun dried tomatoes|sundried tomatoes|getrocknete tomaten', 258, 14, { piece: 5 }],
  ['cipolla|cipolle|onion|onions|zwiebel|zwiebeln|cipolla rossa|cipolla bianca|cipolla dorata|red onion|white onion|yellow onion|rote zwiebel|cipolla di tropea', 40, 1.1, { piece: 110 }],
  ['cipollotto|cipollotti|spring onion|spring onions|scallion|scallions|green onions|fruhlingszwiebel|fruhlingszwiebeln|lauchzwiebel|lauchzwiebeln|cipolline', 32, 1.8, { piece: 15 }],
  ['scalogno|scalogni|shallot|shallots|schalotte|schalotten', 72, 2.5, { piece: 30 }],
  ['porro|porri|leek|leeks|lauch|porree', 61, 1.5, { piece: 200 }],
  ['aglio|garlic|knoblauch|spicchio d aglio|spicchi d aglio|garlic cloves|knoblauchzehe|knoblauchzehen|garlic clove', 149, 6.4, { piece: 4 }],
  ['carota|carote|carrot|carrots|karotte|karotten|mohre|mohren|ruebli|rueblis', 41, 0.9, { piece: 70 }],
  ['sedano|celery|sellerie|staudensellerie|stangensellerie|costa di sedano|coste di sedano|celery stalk|celery stalks|selleriestange|selleriestangen', 16, 0.7, { piece: 40 }],
  ['sedano rapa|celeriac|knollensellerie', 42, 1.5, { piece: 500 }],
  ['patata|patate|potato|potatoes|kartoffel|kartoffeln|erdapfel|patate novelle|new potatoes|drillinge|festkochende kartoffeln|mehligkochende kartoffeln', 77, 2, { piece: 170 }],
  ['patata dolce|patate dolci|patata americana|patate americane|sweet potato|sweet potatoes|susskartoffel|susskartoffeln|batata', 86, 1.6, { piece: 250 }],
  ['zucchina|zucchine|zucchini|courgette|courgettes|zucchino|zucchini', 17, 1.2, { piece: 200 }],
  ['melanzana|melanzane|eggplant|eggplants|aubergine|aubergines|auberginen', 25, 1, { piece: 300 }],
  ['peperone|peperoni|bell pepper|bell peppers|red pepper|green pepper|yellow pepper|paprika|paprikaschote|paprikaschoten|peperone rosso|peperone giallo|spitzpaprika', 26, 1, { piece: 160 }],
  ['peperoncino|peperoncini|chili|chilli|chilis|chillies|chilischote|chilischoten|jalapeno|jalapenos|peperoncino fresco|red chili|pfefferoni', 40, 2, { piece: 5 }],
  ['spinaci|spinach|spinat|spinatblatter|baby spinach|babyspinat|blattspinat', 23, 2.9, { pack: 450 }],
  ['bietola|bietole|biete|chard|swiss chard|mangold|erbette', 19, 1.8],
  ['cavolo|cabbage|kohl|weisskohl|cavolo cappuccio|cappuccio|rotkohl|red cabbage|cavolo rosso|blaukraut|rotkraut|weisskraut|spitzkohl|cavolo verza|verza|savoy cabbage|wirsing|chinakohl|pak choi|bok choy', 25, 1.3, { piece: 800 }],
  ['cavolo nero|kale|grunkohl|cavolo riccio|palmkohl', 49, 4.3],
  ['cavolfiore|cauliflower|blumenkohl|karfiol|cavolo romanesco|romanesco', 25, 1.9, { piece: 600 }],
  ['broccoli|broccolo|brokkoli|cime di rapa|broccoletti|friarielli|rapini|broccoli rabe|stangenbrokkoli|broccolini', 34, 2.8, { piece: 350 }],
  ['cavolini di bruxelles|brussels sprouts|rosenkohl|kohlsprossen', 43, 3.4, { piece: 15 }],
  ['lattuga|insalata|lettuce|salat|kopfsalat|eisbergsalat|romana|lattuga romana|romaine|iceberg|insalata verde|green salad|blattsalat|feldsalat|lamb s lettuce|valerianella|songino|misticanza|mixed salad|gemischter salat|insalatina|scarola|indivia|endive|endivie|frisee|lollo|pflucksalat', 15, 1.4, { piece: 300, pack: 125 }],
  ['rucola|arugula|rocket|rauke|ruchetta', 25, 2.6, { pack: 100, bunch: 50 }],
  ['radicchio|radicchio rosso|trevisano|chicoree|chicory|cicoria|catalogna', 23, 1.4, { piece: 250 }],
  ['finocchio|finocchi|fennel|fenchel|fennel bulb', 31, 1.2, { piece: 250 }],
  ['carciofo|carciofi|artichoke|artichokes|artischocke|artischocken|cuori di carciofo|artichoke hearts', 47, 3.3, { piece: 120 }],
  ['asparagi|asparago|asparagus|spargel|grune spargel|weisser spargel|green asparagus|white asparagus', 20, 2.2, { piece: 20, bunch: 500 }],
  ['funghi|fungo|mushroom|mushrooms|pilze|pilz|champignon|champignons|funghi champignon|champignons|prataioli|chiodini|pioppini|finferli|pfifferlinge|chanterelles|shiitake|steinpilze|porcini|funghi porcini|cardoncelli|kraterellen|austernpilze|oyster mushrooms|portobello|brown mushrooms|egerlinge', 24, 3.2, { piece: 20, pack: 250 }],
  ['funghi secchi|porcini secchi|funghi porcini secchi|dried mushrooms|dried porcini|getrocknete pilze|getrocknete steinpilze', 300, 25, { pack: 20 }],
  ['piselli|pisellini|peas|garden peas|green peas|erbsen|erbschen|petits pois', 81, 5.4, { dens: 0.65, pack: 450, can: 250 }],
  ['fagiolini|green beans|french beans|string beans|grune bohnen|prinzessbohnen|buschbohnen|stangenbohnen|cornetti|taccole|snow peas|zuckerschoten|kaiserschoten', 31, 1.8],
  ['fave|fava beans|broad beans|dicke bohnen|saubohnen|favette', 88, 7.6],
  ['mais|corn|sweetcorn|sweet corn|zuckermais|corn kernels|maiskorner|pannocchia|corn on the cob|maiskolben', 86, 3.3, { can: 285, piece: 200, dens: 0.7 }],
  ['cetriolo|cetrioli|cucumber|cucumbers|gurke|gurken|salatgurke|cetriolini|cornichons|gewurzgurken|essiggurken|pickles|gherkins', 15, 0.7, { piece: 300 }],
  ['zucca|pumpkin|squash|butternut|butternut squash|kurbis|hokkaido|hokkaidokurbis|butternusskurbis|zucca mantovana|delica', 26, 1, { piece: 1500 }],
  ['barbabietola|barbabietole|beetroot|beet|beets|rote bete|rote beete|rande|randen', 43, 1.6, { piece: 120 }],
  ['ravanelli|ravanello|radish|radishes|radieschen|rettich|daikon', 16, 0.7, { piece: 10, bunch: 150 }],
  ['rapa|rape|turnip|turnips|steckrube|kohlrabi|kohlrabi', 28, 1, { piece: 250 }],
  ['pastinaca|pastinache|parsnip|parsnips|pastinake|pastinaken|petersilienwurzel', 75, 1.2, { piece: 120 }],
  ['avocado|avocados', 160, 2, { piece: 150 }],
  ['olive|olives|oliven|olive nere|olive verdi|black olives|green olives|schwarze oliven|grune oliven|olive taggiasche|kalamata', 115, 0.8, { piece: 4, dens: 0.6 }],
  ['capperi|capers|kapern|cucunci', 23, 2.4, { dens: 0.6 }],
  ['germogli|sprouts|bean sprouts|sojasprossen|mungbohnensprossen|sprossen', 30, 3, { pack: 100 }],
  ['zenzero|ginger|ingwer|zenzero fresco|fresh ginger|ingwerwurzel', 80, 1.8, { piece: 15, dens: 0.6 }],
  // legumes and soy (canned / cooked unless dried)
  ['ceci|chickpeas|chick peas|garbanzo|garbanzos|kichererbsen|ceci lessati|ceci in scatola|canned chickpeas|cooked chickpeas', 125, 7, { can: 240, dens: 0.65 }],
  ['ceci secchi|dried chickpeas|getrocknete kichererbsen', 364, 19, { dens: 0.8 }],
  ['fagioli|beans|bohnen|fagioli borlotti|borlotti|cannellini|fagioli cannellini|kidney beans|kidneybohnen|black beans|schwarze bohnen|white beans|weisse bohnen|fagioli neri|fagioli rossi|pinto beans|fagioli lessati|canned beans|baked beans', 110, 7.5, { can: 240, dens: 0.65 }],
  ['fagioli secchi|dried beans|getrocknete bohnen', 330, 21, { dens: 0.8 }],
  ['lenticchie|lentils|linsen|lenticchie rosse|red lentils|rote linsen|berglinsen|beluga linsen|tellerlinsen|lenticchie secche|dried lentils', 350, 24, { dens: 0.8 }],
  ['lenticchie lessate|lenticchie in scatola|cooked lentils|canned lentils|linsen aus der dose|gekochte linsen', 116, 9, { can: 240 }],
  ['piselli secchi|split peas|spalterbsen|cicerchie', 340, 23, { dens: 0.8 }],
  ['edamame', 121, 12],
  ['tofu|tofu naturale|firm tofu|naturtofu|raucher tofu|seidentofu|silken tofu', 120, 13, { pack: 200 }],
  ['tempeh', 192, 20, { pack: 200 }],
  ['seitan', 120, 24, { pack: 200 }],
  // fruit
  ['mela|mele|apple|apples|apfel|apfeln|mela golden|mele renette|renetta|boskop', 52, 0.3, { piece: 180 }],
  ['pera|pere|pear|pears|birne|birnen', 57, 0.4, { piece: 180 }],
  ['banana|banane|bananas|bananen', 89, 1.1, { piece: 120 }],
  ['limone|limoni|lemon|lemons|zitrone|zitronen|lime|limes|limetta|limette|limetten', 29, 1.1, { piece: 100 }],
  ['succo di limone|lemon juice|zitronensaft|succo di lime|lime juice|limettensaft|succo di mezzo limone', 22, 0.4, { dens: 1 }],
  ['scorza di limone|scorza grattugiata|buccia di limone|scorza d arancia|scorza di arancia|lemon zest|orange zest|zest|grated zest|zitronenschale|orangenschale|abrieb|zitronenabrieb|buccia grattugiata', 50, 1.5, { piece: 3, dens: 0.4 }],
  ['arancia|arance|orange|oranges|orangen|apfelsine|mandarino|mandarini|mandarin|mandarinen|clementine|clementinen|clementines|pompelmo|grapefruit', 47, 0.9, { piece: 180 }],
  ['succo d arancia|succo di arancia|spremuta|orange juice|orangensaft|o saft', 45, 0.7, { dens: 1.04 }],
  ['fragole|fragola|strawberries|strawberry|erdbeeren|erdbeere', 32, 0.7, { piece: 12, pack: 250 }],
  ['frutti di bosco|mixed berries|berries|beeren|beerenmischung|waldbeeren|ribes|currants|johannisbeeren|more|blackberries|brombeeren', 45, 1, { dens: 0.6, pack: 250 }],
  ['mirtilli|blueberries|blueberry|heidelbeeren|blaubeeren|cranberries|cranberry|preiselbeeren', 57, 0.7, { dens: 0.6, pack: 125 }],
  ['lamponi|raspberries|raspberry|himbeeren|himbeere', 52, 1.2, { dens: 0.5, pack: 125 }],
  ['pesca|pesche|peach|peaches|pfirsich|pfirsiche|nettarina|nettarine|nectarine|nectarines|nektarine|nektarinen|percoche', 39, 0.9, { piece: 150 }],
  ['albicocca|albicocche|apricot|apricots|aprikose|aprikosen|marille|marillen', 48, 1.4, { piece: 40 }],
  ['albicocche secche|dried apricots|getrocknete aprikosen|prugne secche|prunes|trockenpflaumen|fichi secchi|dried figs|getrocknete feigen', 240, 3, { piece: 8 }],
  ['ciliegie|ciliegia|cherries|cherry|kirschen|kirsche|amarene|sauerkirschen|amarene sciroppate', 63, 1, { piece: 8 }],
  ['uva|grapes|trauben|weintrauben|uva bianca|uva nera|acini', 69, 0.7, { piece: 5 }],
  ['ananas|pineapple', 50, 0.5, { piece: 900, can: 340 }],
  ['mango|mangos|mangoes', 60, 0.8, { piece: 300 }],
  ['kiwi|kiwis', 61, 1.1, { piece: 75 }],
  ['fichi|fico|figs|fig|feigen|feige', 74, 0.8, { piece: 50 }],
  ['prugne|prugna|susine|plums|plum|pflaumen|zwetschgen|zwetschken', 46, 0.7, { piece: 50 }],
  ['melone|melon|melone cantalupo|cantaloupe|honeydew|honigmelone|cocomero|anguria|watermelon|wassermelone', 34, 0.8, { piece: 1000 }],
  ['melograno|pomegranate|granatapfel|chicchi di melograno|pomegranate seeds|granatapfelkerne', 83, 1.7, { piece: 250, dens: 0.6 }],
  ['uvetta|uva sultanina|uva passa|raisins|sultanas|rosinen|sultaninen', 299, 3.1, { dens: 0.6 }],
  ['datteri|dattero|dates|date|datteln|medjool', 282, 2.5, { piece: 8 }],
  ['cocco|cocco rape|cocco grattugiato|farina di cocco|coconut|desiccated coconut|shredded coconut|kokosraspeln|kokosflocken', 660, 7, { dens: 0.35 }],
  ['latte di cocco|coconut milk|kokosmilch|crema di cocco|coconut cream|kokoscreme', 197, 2, { can: 400, dens: 1 }],
  // nuts and seeds
  ['mandorle|mandorla|almonds|almond|mandeln|mandel|mandorle pelate|mandorle a lamelle|flaked almonds|sliced almonds|mandelblattchen|mandelstifte', 579, 21, { piece: 1.2, dens: 0.55 }],
  ['nocciole|nocciola|hazelnuts|hazelnut|haselnusse|haselnuss|haselnusskerne|gemahlene haselnusse|nocciole tostate', 628, 15, { piece: 1, dens: 0.55 }],
  ['noci|noce|walnuts|walnut|walnusse|walnuss|walnusskerne|gherigli di noce|pecan|pecans|pecannusse', 654, 15, { piece: 5, dens: 0.45 }],
  ['pinoli|pine nuts|pinienkerne', 673, 14, { dens: 0.6 }],
  ['pistacchi|pistacchio|pistachios|pistachio|pistazien|granella di pistacchio', 560, 20, { dens: 0.55 }],
  ['arachidi|noccioline|peanuts|peanut|erdnusse|erdnuss|erdnusskerne', 567, 26, { dens: 0.6 }],
  ['anacardi|cashews|cashew|cashewkerne|cashewnusse|macadamia', 560, 18, { dens: 0.6 }],
  ['semi di girasole|sunflower seeds|sonnenblumenkerne', 584, 21, { dens: 0.6 }],
  ['semi di zucca|pumpkin seeds|pepitas|kurbiskerne', 559, 30, { dens: 0.6 }],
  ['sesamo|semi di sesamo|sesame|sesame seeds|sesam|sesamsamen', 573, 18, { dens: 0.6 }],
  ['semi di chia|chia|chia seeds|chiasamen', 486, 17, { dens: 0.65 }],
  ['semi di lino|lino|flax|flaxseed|flaxseeds|linseed|leinsamen', 534, 18, { dens: 0.6 }],
  ['tahina|tahini|tahin|crema di sesamo|sesampaste', 595, 17, { dens: 1 }],
  ['burro di arachidi|peanut butter|erdnussbutter|erdnussmus|burro di mandorle|almond butter|mandelmus|nut butter', 590, 24, { dens: 1.05 }],
  ['nutella|crema di nocciole|crema spalmabile|nuss nougat creme|nougatcreme|chocolate spread|hazelnut spread', 539, 6.3, { dens: 1.2 }],
  // fats and oils
  ['olio|oil|ol|olio d oliva|olio di oliva|olio extravergine|olio extra vergine|olio evo|evo|extravergine|olive oil|extra virgin olive oil|olivenol|olio di semi|olio di girasole|olio di arachidi|olio di mais|vegetable oil|sunflower oil|canola oil|rapeseed oil|rapsol|sonnenblumenol|pflanzenol|speiseol|neutrales ol|sesamol|sesame oil|olio di sesamo|kokosol|coconut oil|olio di cocco|frying oil|olio per friggere|bratol', 884, 0, { dens: 0.92 }],
  ['strutto|lard|schmalz|schweineschmalz|grasso', 902, 0, { dens: 0.9 }],
  ['margarina|margarine|vegan butter|pflanzenmargarine|alsan', 717, 0.2, { dens: 0.95, pack: 250 }],
  ['maionese|mayonnaise|mayo|majonase', 680, 1, { dens: 0.95 }],
  // sugar, sweets, baking
  ['zucchero|sugar|zucker|zucchero semolato|zucchero di canna|brown sugar|caster sugar|granulated sugar|rohrzucker|brauner zucker|kristallzucker|feinzucker|zucchero integrale|muscovado|zucchero a velo|icing sugar|powdered sugar|confectioners sugar|puderzucker|staubzucker|zucchero vanigliato|vanillezucker|vanilla sugar|vanillinzucker|bourbon vanillezucker|hagelzucker|gelierzucker', 400, 0, { dens: 0.85, pack: 8 }],
  ['miele|honey|honig', 304, 0.3, { dens: 1.42 }],
  ['sciroppo d acero|maple syrup|ahornsirup|sciroppo d agave|agave|agavensirup|agave syrup|sciroppo|syrup|sirup|golden syrup|zuckersirup|melassa|molasses|reissirup|sciroppo di glucosio|glucose|glucosio', 280, 0, { dens: 1.33 }],
  ['marmellata|confettura|jam|marmalade|marmelade|konfiture|preserves|gelee|composta|fruchtaufstrich|confettura di albicocche|apricot jam|aprikosenmarmelade', 250, 0.4, { dens: 1.3 }],
  ['cioccolato fondente|cioccolato extra fondente|dark chocolate|bittersweet chocolate|semisweet chocolate|zartbitterschokolade|bitterschokolade|herbe schokolade|cioccolato|chocolate|schokolade|kuvertüre|kuverture|couverture|cioccolato da copertura|gocce di cioccolato|chocolate chips|chocolate chunks|schokotropfen|schokostuckchen|scaglie di cioccolato|schokoraspeln', 550, 6.5, { piece: 5, pack: 100, dens: 0.6 }],
  ['cioccolato al latte|milk chocolate|vollmilchschokolade|milchschokolade|cioccolato bianco|white chocolate|weisse schokolade', 537, 7, { piece: 5, pack: 100 }],
  ['cacao|cacao amaro|cocoa|cocoa powder|unsweetened cocoa|kakao|kakaopulver|backkakao|cacao in polvere', 228, 19.6, { dens: 0.45 }],
  ['amido di mais|maizena|cornstarch|corn starch|cornflour|speisestarke|starke|maisstarke|fecola|fecola di patate|potato starch|kartoffelstarke|amido|arrowroot', 381, 0.3, { dens: 0.55 }],
  ['gelatina|colla di pesce|gelatin|gelatine|gelatine sheets|blattgelatine|fogli di gelatina|gelatina in fogli|agar agar|agar', 335, 86, { piece: 2, pack: 10 }],
  ['vaniglia|vanilla|vanille|bacca di vaniglia|baccello di vaniglia|vanilla bean|vanilla pod|vanilleschote|estratto di vaniglia|vanilla extract|vanilleextrakt|vanillin|vanillina|aroma vaniglia|vanillearoma', 0, 0, { piece: 2, dens: 0.9 }],
  ['budino|pudding|puddingpulver|vanillepuddingpulver|custard powder', 370, 0.3, { pack: 37 }],
  ['canditi|candied peel|zitronat|orangeat|frutta candita|candied fruit', 320, 0.3, { dens: 0.6 }],
  ['marzapane|marzipan|marzipanrohmasse|pasta di mandorle', 450, 8],
  ['meringhe|meringues|baisers|meringue', 390, 5, { piece: 5 }],
  ['panettone|pandoro|colomba|stollen|christstollen', 400, 7, { slice: 80 }],
  ['gelato|ice cream|speiseeis|eiscreme|vanilleeis|vanilla ice cream', 207, 3.5, { dens: 0.55 }],
  ['panna montata|whipped cream|schlagsahne geschlagen|sprühsahne', 257, 3.2, { dens: 0.3 }],
  // drinks
  ['vino|wine|wein|vino bianco|white wine|weisswein|vino rosso|red wine|rotwein|vino secco|dry white wine|trockener weisswein|rose|rosewein|glühwein|gluhwein|sangria', 83, 0.1, { dens: 1 }],
  ['prosecco|spumante|sekt|champagne|champagner|cava|franciacorta|crémant|cremant|sparkling wine|schaumwein|frizzante', 75, 0.2, { dens: 1 }],
  ['birra|beer|bier|lager|ale|pils|weissbier|weizenbier|stout|helles|dunkelbier|radler', 43, 0.5, { dens: 1, can: 330, piece: 330 }],
  ['marsala|porto|port|portwein|sherry|madeira|vin santo|moscato|passito|dessert wine|marsala secco|marsala dolce', 160, 0.1, { dens: 1 }],
  ['vermouth|vermut|wermut|martini rosso|martini bianco|martini dry|lillet|noilly prat|carpano|punt e mes|cynar|averna|amaro|amari|aperol|select|kräuterlikör|krauterlikor|bitter|jagermeister', 160, 0, { dens: 1 }],
  ['campari|campari bitter|bitter campari', 230, 0, { dens: 1 }],
  ['gin|vodka|wodka|rum|rhum|whisky|whiskey|bourbon|scotch|grappa|brandy|cognac|tequila|mezcal|cachaca|pisco|kirsch|kirschwasser|schnaps|obstbrand|calvados|armagnac|acquavite|korn', 235, 0, { dens: 0.95 }],
  ['liquore|liqueur|likor|amaretto|limoncello|cointreau|triple sec|grand marnier|baileys|kahlua|maraschino|sambuca|frangelico|eierlikor|creme de cassis|st germain|elderflower liqueur|holunderblutenlikor|alchermes|rum liqueur|nocino', 300, 0, { dens: 1.05 }],
  ['sciroppo di zucchero|simple syrup|sugar syrup|zuckersirup|sciroppo di sambuco|sambuco|elderflower syrup|holundersirup|holunderblutensirup|grenadine|granatine|sciroppo di menta|orgeat|sciroppo d orzata|orzata|sirup', 260, 0, { dens: 1.3 }],
  ['acqua tonica|tonic|tonic water|tonica|ginger ale|ginger beer|limonata|lemonade|limonade|aranciata|cola|coca cola|gazzosa|sprite|bitter lemon|chinotto|spezi', 38, 0, { dens: 1, can: 330 }],
  ['succo|juice|saft|succo di frutta|fruit juice|fruchtsaft|apfelsaft|apple juice|succo di mela|succo di pomodoro|tomato juice|tomatensaft|succo d ananas|pineapple juice|ananassaft|cranberry juice|succo di mirtillo|preiselbeersaft|traubensaft|grape juice|succo di pompelmo|grapefruit juice|grapefruitsaft|nettare|nektar', 45, 0.4, { dens: 1.04 }],
  ['latte di soia|soy milk|soya milk|sojamilch|sojadrink|bevanda di soia|latte vegetale|plant milk|pflanzenmilch|latte d avena|latte di avena|oat milk|hafermilch|haferdrink|bevanda d avena|latte di mandorla|almond milk|mandelmilch|mandeldrink|latte di riso|rice milk|reismilch|reisdrink', 42, 1.8, { dens: 1.03 }],
  ['caffe|coffee|kaffee|espresso|caffe espresso|caffe forte|strong coffee|starker kaffee|cold brew|filterkaffee', 2, 0.1, { dens: 1 }],
  ['te|tea|tee|te verde|green tea|gruner tee|te nero|black tea|schwarzer tee|tisana|infuso|herbal tea|krautertee|chai|matcha|bustina di te|teebeutel|tea bag|tea bags', 1, 0, { dens: 1, piece: 2 }],
  ['acqua|water|wasser|acqua frizzante|acqua gassata|soda|soda water|club soda|sparkling water|mineral water|mineralwasser|sprudelwasser|seltz|selz|acqua di seltz|acqua minerale|acqua calda|acqua fredda|hot water|cold water|eiswasser|leitungswasser', 0, 0, { dens: 1 }],
  ['ghiaccio|ice|ice cubes|eiswurfel|cubetti di ghiaccio|ghiaccio tritato|crushed ice|crushed eis|eis', 0, 0, { dens: 0.9, piece: 25 }],
  // seasonings, sauces, stock
  ['sale|salt|salz|sale fino|sale grosso|meersalz|sea salt|fleur de sel|kosher salt|sale marino|salz und pfeffer|sale e pepe|salt and pepper', 0, 0, { dens: 1.2 }],
  ['pepe|pepper|pfeffer|pepe nero|black pepper|schwarzer pfeffer|pepe bianco|white pepper|weisser pfeffer|pepe macinato|ground pepper|pfefferkorner|peppercorns|pepe in grani|pepe rosa|pink pepper', 250, 10, SPICE],
  ['cannella|cinnamon|zimt|stecca di cannella|cinnamon stick|zimtstange|zimtstangen|noce moscata|nutmeg|muskat|muskatnuss|chiodi di garofano|chiodo di garofano|cloves|nelken|gewurznelken|curry|currypulver|curry powder|curcuma|turmeric|kurkuma|cumino|cumin|kreuzkummel|kummel|caraway|coriandolo in polvere|ground coriander|koriander gemahlen|paprika dolce|paprika affumicata|paprikapulver|smoked paprika|sweet paprika|paprika edelsuss|rosenpaprika|peperoncino in polvere|chili powder|chilipulver|cayenne|cayennepfeffer|peperoncino secco|chili flakes|chiliflocken|red pepper flakes|zafferano|saffron|safran|pistilli di zafferano|anice stellato|star anise|sternanis|anice|anise|anis|cardamomo|cardamom|kardamom|semi di finocchio|fennel seeds|fenchelsamen|garam masala|ras el hanout|zatar|za atar|sumac|sumach|lebkuchengewurz|spekulatiusgewurz|spezie|spices|gewurze|gewurz|bacche di ginepro|juniper|wacholderbeeren|wacholder|pimento|piment|allspice|senape in polvere|mustard powder|aglio in polvere|garlic powder|knoblauchpulver|cipolla in polvere|onion powder|zwiebelpulver|lievito alimentare|nutritional yeast|hefeflocken', 300, 10, SPICE],
  ['basilico|basil|basilikum|prezzemolo|parsley|petersilie|rosmarino|rosemary|rosmarin|salvia|sage|salbei|timo|thyme|thymian|origano|oregano|maggiorana|marjoram|majoran|menta|mint|minze|pfefferminze|erba cipollina|chives|schnittlauch|aneto|dill|coriandolo|cilantro|coriander|koriander|dragoncello|tarragon|estragon|alloro|bay leaf|bay leaves|lorbeer|lorbeerblatt|lorbeerblatter|foglie di alloro|erbe aromatiche|herbs|krauter|kraeuter|erbe|mazzetto di erbe|bouquet garni|italienische krauter|herbes de provence|krauter der provence|lemongrass|citronella|zitronengras|levistico|liebstockel|borragine|kerbel|chervil|cerfoglio|melissa|lemon balm|zitronenmelisse|sambuco fiori|foglie di menta|mint leaves|basilikumblatter|foglie di basilico|basil leaves|foglie di salvia|sage leaves', 40, 3, HERB],
  ['brodo|broth|stock|bruhe|fond|brodo vegetale|vegetable stock|vegetable broth|gemusebruhe|brodo di carne|beef stock|rinderbruhe|fleischbruhe|brodo di pollo|chicken stock|chicken broth|huhnerbruhe|brodo di pesce|fish stock|fischfond|fumetto|bouillon|consomme|kraftbruhe', 6, 0.6, { dens: 1 }],
  ['dado|dado da brodo|stock cube|bouillon cube|bruhwurfel|suppenwurfel|granulare|brodo granulare|gemusebruhe pulver|instant bruhe|dado vegetale', 250, 10, { piece: 10, dens: 0.8 }],
  ['aceto|vinegar|essig|aceto di vino|wine vinegar|weinessig|aceto di mele|apple cider vinegar|apfelessig|aceto di riso|rice vinegar|reisessig|aceto bianco|white vinegar|branntweinessig', 20, 0, { dens: 1 }],
  ['aceto balsamico|balsamic|balsamic vinegar|balsamico|balsamessig|glassa di aceto balsamico|balsamic glaze|balsamicocreme|crema di balsamico', 110, 0.5, { dens: 1.15 }],
  ['salsa di soia|soy sauce|sojasauce|soja sauce|shoyu|tamari|salsa di soia scura', 53, 8, { dens: 1.15 }],
  ['senape|mustard|senf|dijon|senape di digione|dijon mustard|dijonsenf|grainy mustard|senape in grani|mittelscharfer senf|scharfer senf|susser senf|kremser senf', 66, 4, { dens: 1.05 }],
  ['ketchup|tomato ketchup|tomatenketchup', 112, 1.2, { dens: 1.15 }],
  ['pesto|pesto alla genovese|pesto genovese|basil pesto|basilikumpesto|pesto rosso|pesto di basilico', 450, 5, { dens: 1, pack: 190 }],
  ['worcestershire|worcester|worcestersauce|tabasco|salsa piccante|hot sauce|sriracha|sambal|sambal oelek|harissa|scharfe sauce|chilisauce|chili sauce|salsa di pesce|fish sauce|fischsauce|salsa ostrica|oyster sauce|austernsauce|hoisin|teriyaki|salsa barbecue|barbecue sauce|bbq sauce|grillsauce|miso|pasta di miso|curry paste|pasta di curry|currypaste|rote currypaste|grune currypaste|gochujang|wasabi', 120, 3, { dens: 1.1 }],
  ['salsa|sauce|sosse|sugo|dressing|condimento|vinaigrette|salsa verde|guacamole|hummus|tzatziki|aioli|salsa tonnata|bechamel|besciamella|bechamelsauce|white sauce|hollandaise|sauce hollandaise|ragu|ragù|bolognese|sugo alla bolognese|bolognesesauce', 120, 3, { dens: 1 }],
  ['olive in salamoia|cetrioli sott aceto|sottaceti|giardiniera|sauerkraut|crauti|kimchi|carciofini sott olio|antipasto misto', 30, 1.2, { dens: 0.8, can: 300 }],
];

// ---------- matching ----------

export function simplify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/['’`]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const INDEX = [];
FOODS.forEach(([keys, kcal, prot, extra = {}], i) => {
  const food = { id: i, name: keys.split('|')[0], kcal, prot, ...extra };
  for (const k of new Set(keys.split('|').map(simplify).filter(Boolean))) INDEX.push({ k, words: k.split(' '), food });
});
// longest keyword first: "latte di cocco" before "latte", "olio d oliva" before "oliva"
INDEX.sort((a, b) => b.k.length - a.k.length);

// Does the keyword word `kw` match the ingredient word `w`?
//  - same word, or a short ending (plurals: pomodor-i, kartoffel-n, apfel-s)
//  - German compounds: the keyword at the end of a longer word ("bergkase", "rinderhackfleisch")
//    or, for long keywords, at the start ("hahnchenbrustfilet")
function wordMatch(w, kw) {
  if (w === kw) return true;
  if (w.startsWith(kw) && w.length - kw.length <= (kw.length >= 4 ? 3 : 1)) return true;
  if (kw.length >= 4 && w.length > kw.length) {
    const at = w.lastIndexOf(kw);
    if (at > 0 && w.length - (at + kw.length) <= 2) return true;
    if (kw.length >= 7 && w.startsWith(kw)) return true;
  }
  return false;
}

function matchAt(words, i, entry) {
  if (entry.words.length === 1) return wordMatch(words[i], entry.words[0]);
  // multi-word keywords: every word in order; the last may be a compound/plural
  for (let j = 0; j < entry.words.length; j++) {
    const w = words[i + j];
    if (w == null) return false;
    const kw = entry.words[j];
    if (j < entry.words.length - 1 ? !(w === kw || (w.startsWith(kw) && w.length - kw.length <= 2)) : !wordMatch(w, kw)) return false;
  }
  return true;
}

const memo = new Map();
/** Best matching food for an ingredient name, or null. */
export function findFood(name) {
  const s = simplify(name);
  if (memo.has(s)) return memo.get(s);
  const words = s.split(' ').filter(Boolean);
  let best = null;
  for (const e of INDEX) {
    if (best && e.k.length < best.k.length) break; // sorted by length: nothing longer can follow
    for (let i = 0; i < words.length; i++) {
      if (matchAt(words, i, e)) {
        // same length: prefer the match nearest the start (Italian head noun first)
        if (!best || i < best.i) best = { k: e.k, i, food: e.food };
        break;
      }
    }
  }
  const out = best ? best.food : null;
  if (memo.size > 5000) memo.clear();
  memo.set(s, out);
  return out;
}

// "1 bicchiere di vino", "una noce di burro", "2 vasetti di yogurt", "1 Glas Wasser"
const CONTAINERS = [
  [/^(?:(?:noce|noci|nocetta)\s+di|(?:knob|knobs)\s+of|flocke|flocken|stuckchen)\s+/, { g: 10 }],
  [/^(?:bicchierino|bicchierini|shot|shots|schnapsglas|stamperl)\s+(?:di\s+|of\s+)?/, { ml: 40 }],
  [/^(?:bicchiere|bicchieri|glass|glasses|glas|glaser)\s+(?:di\s+|of\s+)?/, { ml: 200 }],
  [/^(?:tazza|tazze|mug|mugs|tasse|tassen)\s+(?:di\s+|of\s+)?/, { ml: 240 }],
  [/^(?:tazzina|tazzine)\s+(?:di\s+|of\s+)?/, { ml: 50 }],
  [/^(?:mestolo|mestoli|ladle|ladles|schopfkelle|kelle)\s+(?:di\s+|of\s+)?/, { ml: 100 }],
  [/^(?:vasetto|vasetti|pot|pots|becher)\s+(?:di\s+|of\s+)?/, { g: 125 }],
  [/^(?:barattolo|barattoli|jar|jars)\s+(?:di\s+|of\s+)?/, { can: true }],
  [/^(?:scatola|scatole|scatoletta|scatolette|lattina|lattine|tin|tins|dose|dosen)\s+(?:di\s+|of\s+)?/, { can: true }],
  [/^(?:confezione|confezioni|pacco|pacchi|pacchetto|pacchetti|bustina|bustine|busta|buste|vaschetta|vaschette|panetto|panetti|package|packages|pack|packs|packet|packets|bag|bags|packung|packungen|packchen|beutel|tute|tuten|tuete|stange|stangen)\s+(?:di\s+|of\s+)?/, { pack: true }],
  [/^(?:fetta|fette|fettina|fettine|slice|slices|scheibe|scheiben)\s+(?:di\s+|of\s+)?/, { slice: true }],
  [/^(?:mazzetto|mazzetti|mazzo|mazzi|ciuffo|ciuffi|bunch|bunches|bund|bundel|handful|handfuls|manciata|manciate|handvoll)\s+(?:di\s+|of\s+)?/, { g: 25 }],
  [/^(?:rametto|rametti|rametto di|sprig|sprigs|zweig|zweige|zweiglein|stangel|stiel|stiele)\s+(?:di\s+|of\s+)?/, { g: 2 }],
  [/^(?:foglia|foglie|foglioline|leaf|leaves|blatt|blatter|blattchen)\s+(?:di\s+|of\s+)?/, { g: 0.5 }],
  [/^(?:pizzico|pizzichi|presa|prise|prisen|dash|dashes|spruzzo|spruzzata|schuss|spritzer|goccio|gocce|drop|drops|tropfen)\s+(?:di\s+|of\s+)?/, { g: 0.5 }],
  [/^(?:cucchiaio|cucchiai|cucchiaiata|tablespoon|tablespoons|esslöffel|essloffel)\s+(?:di\s+|of\s+)?(?:raso|rasi|colmo|colmi\s+)?/, { ml: 15 }],
  [/^(?:cucchiaino|cucchiaini|teaspoon|teaspoons|teeloffel)\s+(?:di\s+|of\s+)?/, { ml: 5 }],
  [/^(?:spicchio|spicchi|clove|cloves|zehe|zehen)\s+(?:di\s+|d\s+|of\s+)?/, { piece: true }],
  [/^(?:testa|teste|bulb|bulbs|knolle|knollen|cespo|cespi|kopf|kopfe)\s+(?:di\s+|d\s+|of\s+)?/, { g: null, whole: true }],
];

const UNIT_G = { g: 1, kg: 1000, mg: 0.001, oz: 28.3495, lb: 453.592 };
const UNIT_ML = { ml: 1, l: 1000, dl: 100, cl: 10, tsp: 5, tbsp: 15, cup: 240, floz: 29.5735 };

/**
 * Grams of one parsed ingredient {qty, unit, name}, using the food's piece weight / density.
 * Returns {grams, food} — grams null when it can't be worked out; food null when unknown.
 */
export function gramsOf(ing) {
  let name = simplify(ing.name);
  let qty = ing.qty;
  let unit = ing.unit || '';
  let container = null;
  for (const [re, c] of CONTAINERS) {
    const m = name.match(re);
    if (m && m[0].length < name.length) { container = c; name = name.slice(m[0].length); break; }
  }
  const food = findFood(name);
  if (!food) return { grams: null, food: null };
  if (qty == null) return { grams: null, food, toTaste: true };
  const dens = food.dens || 1;
  if (unit in UNIT_G) return { grams: qty * UNIT_G[unit], food };
  if (unit in UNIT_ML) return { grams: qty * UNIT_ML[unit] * dens, food };
  if (unit === 'pinch') return { grams: qty * 0.4, food };
  if (unit === 'clove') return { grams: qty * (food.piece && food.piece < 10 ? food.piece : 4), food };
  if (unit === 'slice') return { grams: qty * (food.slice || food.piece || 25), food };
  if (unit === 'bunch') return { grams: qty * (food.bunch || 25), food };
  if (unit === 'can') return { grams: qty * (food.can || 400), food };
  if (unit === 'packet') return { grams: qty * (food.pack || 250), food };
  if (container) {
    if (container.g !== undefined && container.g !== null) return { grams: qty * container.g, food };
    if (container.ml) return { grams: qty * container.ml * dens, food };
    if (container.can) return { grams: qty * (food.can || food.pack || 400), food };
    if (container.pack) return { grams: qty * (food.pack || food.can || 250), food };
    if (container.slice) return { grams: qty * (food.slice || 25), food };
    if (container.piece) return { grams: qty * (food.piece || 4), food };
    if (container.whole) return { grams: qty * (food.piece ? food.piece * 10 : 300), food };
  }
  if (unit === '' || unit === 'pcs') return food.piece ? { grams: qty * food.piece, food } : { grams: null, food };
  return { grams: null, food };
}

/**
 * Estimated calories and protein of a whole recipe (as written, for r.servings people).
 * Result: { kcal, protein, perServing: {kcal, protein}, servings, known, unknown: [names],
 *           items: [{name, grams, kcal, protein}], partial } — or null when nothing could be estimated.
 * Ingredients "to taste" (no quantity) are left out.
 */
export function estimateNutrition(r) {
  const servings = r.servings || 4;
  let kcal = 0;
  let protein = 0;
  const items = [];
  const unknown = [];
  let skipped = 0;
  for (const raw of r.ingredients || []) {
    const ing = raw.name != null ? raw : parseIngredient(raw.raw || '');
    if (!ing.name) continue;
    if (ing.qty == null) { skipped++; continue; }
    const { grams, food } = gramsOf(ing);
    if (!food || grams == null) { unknown.push(ing.name); continue; }
    const k = (grams * food.kcal) / 100;
    const p = (grams * food.prot) / 100;
    kcal += k;
    protein += p;
    items.push({ name: ing.name, food: food.name, grams, kcal: k, protein: p });
  }
  if (!items.length) return null;
  // partial: something with a quantity wasn't recognised
  const partial = unknown.length > 0;
  return {
    kcal, protein, servings, items, unknown, skipped, partial,
    known: items.length,
    perServing: { kcal: kcal / servings, protein: protein / servings },
  };
}

const cache = new Map();
/** Cached per recipe version (id + updatedAt). */
export function nutritionOf(r) {
  const key = `${r.id}|${r.updatedAt || ''}|${r.servings || ''}`;
  if (cache.has(key)) return cache.get(key);
  const n = estimateNutrition(r);
  if (cache.size > 2000) cache.clear();
  cache.set(key, n);
  return n;
}
