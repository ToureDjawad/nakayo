# Niveaux des testeurs · Bronze, Argent, Or (US-38)

Le niveau récompense l'assiduité. Il est recalculé à chaque lecture, à partir de l'historique du testeur : aucune donnée n'est stockée à part.

## 1. Règles

| Niveau | Conditions |
|---|---|
| Bronze | au départ |
| Argent | 1 campagne menée au bout (affectation `terminee`) |
| Or | 3 campagnes menées au bout, 2 bugs acceptés par un développeur, assiduité d'au moins 75 % |

- Assiduité : `(terminées + 1) / (terminées + remplacées + remises à zéro + 2)`, en pourcentage entier (la même formule que l'affectation, US-16). Un nouveau testeur part à 50 %.
- On ne saute pas de niveau : des bugs acceptés sans campagne menée au bout laissent en Bronze.
- Le niveau peut redescendre : un testeur Or souvent remplacé repasse Argent.

## 2. Effet sur l'affectation

Offres Pro et Plus (`testeursConfirmes`) : les testeurs passent par niveau (Or, puis Argent, puis Bronze), puis par assiduité. Les Bronze ne complètent la campagne que s'il manque des testeurs. L'offre Standard ne regarde que l'assiduité.

## 3. API

`GET /api/testeurs/moi` (contrat §4.4) : `utilisateur.niveau`.

```json
{
  "code": "argent",
  "nom": "Argent",
  "campagnesTerminees": 1,
  "bugsAcceptes": 1,
  "assiduite": 66,
  "suivant": {
    "code": "or",
    "nom": "Or",
    "conditions": [
      { "code": "campagnes", "requis": 3, "actuel": 1, "rempli": false },
      { "code": "bugs", "requis": 2, "actuel": 1, "rempli": false },
      { "code": "assiduite", "requis": 75, "actuel": 66, "rempli": false }
    ]
  }
}
```

`suivant` vaut `null` au niveau Or.

## 4. Android

« Mon profil » : carte « Mon niveau » avec le niveau, le bilan (campagnes, bugs, assiduité), l'avantage du niveau et ce qu'il reste à faire pour le suivant.
