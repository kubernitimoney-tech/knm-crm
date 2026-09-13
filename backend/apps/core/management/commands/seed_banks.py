from apps.core.management.commands.seed_bank_names import Command as SeedBankNamesCommand


class Command(SeedBankNamesCommand):
    help = "Alias for seed_bank_names (seed all Indian bank names)."
