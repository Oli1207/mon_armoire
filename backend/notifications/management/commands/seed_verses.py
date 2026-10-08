from django.core.management.base import BaseCommand

from notifications.models import Verse

# Traduction Louis Segond (1910, domaine public).
VERSES = [
    ("Confie-toi en l'Éternel de tout ton cœur, et ne t'appuie pas sur ta sagesse.", "Proverbes 3:5"),
    ("L'Éternel est mon berger : je ne manquerai de rien.", "Psaumes 23:1"),
    ("Que ta bonté, Éternel, soit sur nous, comme nous espérons en toi !", "Psaumes 33:22"),
    ("Car je connais les projets que j'ai formés sur vous, dit l'Éternel, projets de paix et non de malheur.", "Jérémie 29:11"),
    ("Ne crains rien, car je suis avec toi ; ne t'inquiète pas, car je suis ton Dieu.", "Ésaïe 41:10"),
    ("L'amour est patient, il est plein de bonté ; l'amour n'est point envieux.", "1 Corinthiens 13:4"),
    ("Je puis tout par celui qui me fortifie.", "Philippiens 4:13"),
    ("Car Dieu a tant aimé le monde qu'il a donné son Fils unique.", "Jean 3:16"),
    ("Recommande à l'Éternel tes œuvres, et tes projets réussiront.", "Proverbes 16:3"),
    ("Venez à moi, vous tous qui êtes fatigués et chargés, et je vous donnerai du repos.", "Matthieu 11:28"),
    ("Ne vous inquiétez de rien ; mais en toute chose faites connaître vos besoins à Dieu.", "Philippiens 4:6"),
    ("L'Éternel est ma lumière et mon salut : de qui aurais-je crainte ?", "Psaumes 27:1"),
    ("Heureux ceux qui ont faim et soif de la justice, car ils seront rassasiés.", "Matthieu 5:6"),
    ("La joie de l'Éternel, voilà votre force.", "Néhémie 8:10"),
    ("Que votre cœur ne se trouble point. Croyez en Dieu, et croyez en moi.", "Jean 14:1"),
    ("Rendez grâces en toutes choses, car c'est à votre égard la volonté de Dieu.", "1 Thessaloniciens 5:18"),
    ("Fortifie-toi et prends courage, ne t'effraie point et ne t'épouvante point.", "Josué 1:9"),
    ("Toutes choses concourent au bien de ceux qui aiment Dieu.", "Romains 8:28"),
    ("Cherchez premièrement le royaume et la justice de Dieu, et toutes ces choses vous seront données.", "Matthieu 6:33"),
    ("L'Éternel lui-même marchera devant toi ; il ne t'abandonnera point.", "Deutéronome 31:8"),
    ("Que la paix de Christ, à laquelle vous avez été appelés, règne dans vos cœurs.", "Colossiens 3:15"),
    ("Approchez-vous de Dieu, et il s'approchera de vous.", "Jacques 4:8"),
    ("C'est par la grâce que vous êtes sauvés, par le moyen de la foi.", "Éphésiens 2:8"),
    ("Jetez sur lui tous vos soucis, car lui-même prend soin de vous.", "1 Pierre 5:7"),
    ("L'Éternel est bon, il est un refuge au jour de la détresse.", "Nahum 1:7"),
    ("Persévérez dans la prière, veillez-y avec actions de grâces.", "Colossiens 4:2"),
    ("Ayez foi en Dieu, quiconque dira à cette montagne : Ôte-toi de là.", "Marc 11:22-23"),
    ("Ta parole est une lampe à mes pieds, et une lumière sur mon sentier.", "Psaumes 119:105"),
    ("Le Seigneur lui-même descendra du ciel, et nous serons toujours avec le Seigneur.", "1 Thessaloniciens 4:16-17"),
    ("Soyez forts et que votre cœur s'affermisse, vous tous qui espérez en l'Éternel.", "Psaumes 31:25"),
    ("Il pardonne toutes tes iniquités, il guérit toutes tes maladies.", "Psaumes 103:3"),
    ("La grâce et la paix vous soient données de la part de Dieu.", "Romains 1:7"),
    ("Il y a plus de bonheur à donner qu'à recevoir.", "Actes 20:35"),
    ("Le Seigneur est près de tous ceux qui l'invoquent.", "Psaumes 145:18"),
    ("Que celui qui a soif vienne ; que celui qui veut de l'eau de la vie l'ait gratuitement.", "Apocalypse 22:17"),
    ("Ainsi donc, comme vous avez reçu le Seigneur Jésus-Christ, marchez en lui.", "Colossiens 2:6"),
    ("L'Éternel est fidèle en toutes ses paroles, et miséricordieux dans toutes ses œuvres.", "Psaumes 145:13"),
    ("Ne vous conformez pas au siècle présent, mais soyez transformés par le renouvellement de l'intelligence.", "Romains 12:2"),
    ("Frères, réjouissez-vous toujours dans le Seigneur.", "Philippiens 4:4"),
    ("Celui qui demeure dans l'amour demeure en Dieu, et Dieu demeure en lui.", "1 Jean 4:16"),
]


class Command(BaseCommand):
    help = "Alimente le pool de versets naturels (rotation quotidienne automatique)."

    def handle(self, *args, **options):
        created = 0
        for text, reference in VERSES:
            _, was_created = Verse.objects.get_or_create(reference=reference, defaults={'text': text})
            if was_created:
                created += 1
        self.stdout.write(f'{created} nouveau(x) verset(s) ajouté(s) (pool total : {Verse.objects.count()}).')
